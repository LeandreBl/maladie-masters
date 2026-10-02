import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHostAllowed, isOriginAllowed, parseList, parseTicket } from "./guards.js";

describe("isHostAllowed", () => {
  it("allows everything when the list is empty or *", () => {
    assert.equal(isHostAllowed("evil.test", []), true);
    assert.equal(isHostAllowed("evil.test", ["*"]), true);
  });

  it("matches a host with or without its port", () => {
    const hosts = parseList("api.example.com");
    assert.equal(isHostAllowed("api.example.com", hosts), true);
    assert.equal(isHostAllowed("API.example.com:443", hosts), true);
    assert.equal(isHostAllowed("example.com", hosts), false);
    assert.equal(isHostAllowed(undefined, hosts), false);
  });

  it("matches subdomains with a leading dot", () => {
    const hosts = parseList(".example.com");
    assert.equal(isHostAllowed("example.com", hosts), true);
    assert.equal(isHostAllowed("api.example.com", hosts), true);
    assert.equal(isHostAllowed("badexample.com", hosts), false);
  });
});

describe("isOriginAllowed", () => {
  const origins = parseList("http://localhost:5173, https://admin.example.com/");

  it("accepts the listed origins only", () => {
    assert.equal(isOriginAllowed("http://localhost:5173", origins), true);
    assert.equal(isOriginAllowed("https://evil.test", origins), false);
  });

  it("lets non-browser clients through", () => {
    assert.equal(isOriginAllowed(undefined, origins), true);
  });
});

describe("parseTicket", () => {
  it("reads what the backend stores", () => {
    assert.deepEqual(parseTicket('{"userId":"u1","admin":true}'), { userId: "u1", admin: true });
    assert.deepEqual(parseTicket('{"userId":"u1"}'), { userId: "u1", admin: false });
  });

  it("refuses anything else", () => {
    assert.equal(parseTicket(null), null);
    assert.equal(parseTicket("not json"), null);
    assert.equal(parseTicket('{"admin":true}'), null);
    assert.equal(parseTicket('{"userId":""}'), null);
  });
});
