import { test } from "node:test";
import assert from "node:assert/strict";
import { eventLabel, choiceLabel, itemName, changeLines } from "../src/eventLabels.mjs";

test("eventLabel maps every known audit action and passes unknown text through", () => {
  assert.equal(eventLabel("published"), "Published for review");
  assert.equal(eventLabel("published (new cycle)"), "Published again, new review");
  assert.equal(eventLabel("Figma changed: earlier answers dropped"), "Figma changed: earlier answers were cleared, please answer again");
  assert.equal(eventLabel("republished (same Figma state, answers kept)"), "Synced again, nothing changed");
  assert.equal(eventLabel("decided"), "Answered");
  assert.equal(eventLabel("applied"), "Applied by the developer");
  assert.equal(eventLabel("something else"), "something else");
  assert.equal(eventLabel(undefined), "");
  assert.equal(eventLabel(5), "");
});

test("choiceLabel maps the three choices, null and unknown", () => {
  assert.equal(choiceLabel("follow-figma"), "Remove it, to match Figma");
  assert.equal(choiceLabel("keep-deprecated"), "Keep it, but mark it as old");
  assert.equal(choiceLabel("keep"), "Keep it, and add it to Figma");
  assert.equal(choiceLabel(null), "Answer cleared");
  assert.equal(choiceLabel(undefined), "Answer cleared");
  assert.equal(choiceLabel("other"), "other");
});

test("itemName strips the kind and quotes an option", () => {
  assert.equal(itemName("removed-prop:searchable"), "searchable");
  assert.equal(itemName("removed-option:kind=outlined"), 'kind="outlined"');
  assert.equal(itemName("plain"), "plain");
});

test("changeLines lists one line per change with migrate by", () => {
  const lines = changeLines(
    { "removed-prop:searchable": "follow-figma", "removed-option:kind=outlined": "keep", "removed-prop:x": null },
    { "removed-prop:searchable": "Select" },
  );
  assert.deepEqual(lines, [
    "searchable: Remove it, to match Figma, migrate by Select",
    'kind="outlined": Keep it, and add it to Figma',
    "x: Answer cleared",
  ]);
});

test("changeLines of undefined is empty", () => {
  assert.deepEqual(changeLines(undefined), []);
  assert.deepEqual(changeLines("text"), []);
});
