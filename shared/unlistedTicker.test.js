import test from "node:test";
import assert from "node:assert/strict";
import { inferUnlistedListing, isNonEquitySymbol, isTokyoAlphanumericTicker } from "./unlistedTicker.js";

test("tokyo alphanumeric codes are listings", () => {
  assert.equal(isTokyoAlphanumericTicker("151a.t"), true);
  assert.equal(isTokyoAlphanumericTicker("7203.T"), false);
  const hit = inferUnlistedListing("151A.T");
  assert.equal(hit?.market, "jp");
  assert.equal(hit?.ticker, "151A.T");
  assert.equal(hit?.fmpSymbol, "151A.T");
  assert.equal(inferUnlistedListing("183a.t")?.ticker, "183A.T");
  assert.equal(inferUnlistedListing("7203.T")?.market, "jp");
  assert.equal(inferUnlistedListing("285A.T")?.ticker, "285A.T");
});

test("hostnames and morningstar fund ids are not listings", () => {
  for (const symbol of ["www.tcw.com", "www.sv-ac.com", "foo.com", "0P0000RP9B", "0P0000IC0E.T", "0P1000TC5L"]) {
    assert.equal(isNonEquitySymbol(symbol), true, symbol);
    assert.equal(inferUnlistedListing(symbol), null, symbol);
  }
});

test("ordinary tickers are unchanged", () => {
  assert.equal(isNonEquitySymbol("AAPL"), false);
  assert.equal(isNonEquitySymbol("BRK.B"), false);
  assert.equal(isNonEquitySymbol("GLEN.L"), false);
  assert.equal(inferUnlistedListing("BRK.B")?.fmpSymbol, "BRK-B");
  assert.equal(inferUnlistedListing("GLEN.L")?.market, "uk");
  assert.equal(inferUnlistedListing("2222.SR")?.market, "sa");
});
