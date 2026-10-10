import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function launchBrowser() {
  const profile = await mkdtemp(join(tmpdir(), "trinity-browser-"));
  await mkdir(join(profile, "config"));
  await mkdir(join(profile, "cache"));
  const browser = spawn(
    process.env.CHROMIUM_PATH || "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    {
      env: {
        ...process.env,
        XDG_CONFIG_HOME: join(profile, "config"),
        XDG_CACHE_HOME: join(profile, "cache"),
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let output = "";
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(new Error(`Browser startup timed out: ${output.slice(-400)}`)),
      15000,
    );
    browser.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    browser.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Browser exited ${code}: ${output.slice(-400)}`));
    });
  });
  const port = new URL(endpoint).port;
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  const ws = new WebSocket(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve) =>
    ws.addEventListener("open", resolve, { once: true }),
  );
  let sequence = 0;
  const pending = new Map(),
    errors = [],
    requests = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
    if (
      message.method === "Runtime.exceptionThrown" ||
      (message.method === "Runtime.consoleAPICalled" &&
        message.params.type === "error")
    )
      errors.push(message.params);
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.status >= 400
    )
      requests.push({
        url: message.params.response.url,
        status: message.params.response.status,
      });
  });
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Browser command timed out: ${method}`));
      }, 30000);
      pending.set(id, (message) => {
        clearTimeout(timeout);
        message.error
          ? reject(new Error(message.error.message))
          : resolve(message.result);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  const load = async (method, params) => {
    const loaded = new Promise((resolve, reject) => {
      const listener = (event) => {
        if (JSON.parse(event.data).method === "Page.loadEventFired") {
          clearTimeout(timeout);
          ws.removeEventListener("message", listener);
          resolve();
        }
      };
      const timeout = setTimeout(() => {
        ws.removeEventListener("message", listener);
        reject(new Error("Page navigation timed out"));
      }, 30000);
      ws.addEventListener("message", listener);
    });
    await call(method, params);
    await loaded;
  };
  const navigate = (url) => load("Page.navigate", { url });
  const reload = () => load("Page.reload", { ignoreCache: true });
  const waitFor = async (expression, timeout = 20000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await delay(150);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  const boundsFor = (selector) =>
    evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing button');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
  const click = async (selector) => {
    const bounds = await boundsFor(selector);
    await call("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...bounds,
    });
    await call("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...bounds,
    });
  };
  const touch = async (selector) => {
    const bounds = await boundsFor(selector);
    await call("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...bounds, id: 0, radiusX: 5, radiusY: 5, force: 1 }],
    });
    await call("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  const key = async (key, code = key) => {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key, code });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, code });
  };
  const screenshot = async (path) => {
    const shot = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(path, Buffer.from(shot.data, "base64"));
  };
  const close = async () => {
    await call("Browser.close").catch(() => {});
    ws.close();
    browser.kill("SIGTERM");
    await delay(100);
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  return {
    call,
    evaluate,
    waitFor,
    click,
    touch,
    key,
    screenshot,
    close,
    navigate,
    reload,
    errors,
    requests,
  };
}
