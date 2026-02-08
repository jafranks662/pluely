import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { AppProvider, useApp } from "../../src/contexts/app.context.js";
import { LiveSummaryPanel } from "../../src/pages/app/components/speech/LiveSummaryPanel.js";
import {
  createEmptySummary,
  dedupeActionItems,
  dedupeList,
  parseMeetingSummaryWithRepair,
  shouldUpdateSummary,
} from "../../src/lib/meeting/meetingSummarizer.js";
import { STORAGE_KEYS } from "../../src/config/constants.js";

const ModeHarness = () => {
  const { mode } = useApp();
  return <span>{mode}</span>;
};

const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const run = async () => {
  const mockStorage = createMockLocalStorage();
  // @ts-expect-error test shim
  global.window = { localStorage: mockStorage };
  // @ts-expect-error test shim
  global.localStorage = mockStorage;

  mockStorage.clear();
  localStorage.setItem(STORAGE_KEYS.APP_MODE, "meeting");

  const html = renderToString(
    <AppProvider>
      <ModeHarness />
    </AppProvider>
  );

  assert.ok(html.includes("meeting"), "mode should persist from storage");

  const meetingHtml = renderToString(
    <LiveSummaryPanel
      mode="meeting"
      summary={createEmptySummary()}
      updatedAt={null}
      isUpdating={false}
      onUpdate={() => {}}
      onClear={() => {}}
    />
  );
  assert.ok(meetingHtml.includes("Live Summary"));

  const personalHtml = renderToString(
    <LiveSummaryPanel
      mode="personal"
      summary={createEmptySummary()}
      updatedAt={null}
      isUpdating={false}
      onUpdate={() => {}}
      onClear={() => {}}
    />
  );
  assert.ok(!personalHtml.includes("Live Summary"));

  const parsed = await parseMeetingSummaryWithRepair(
    `{"summary":["A"],"decisions":["B"],"actionItems":[{"text":"C"}]`,
    async () =>
      `{"summary":["A"],"decisions":["B"],"actionItems":[{"text":"C"}]}`
  );
  assert.ok(parsed?.summary.includes("A"));

  const deduped = dedupeList(["Task", "Task!", "Next"]);
  assert.deepEqual(deduped, ["Task", "Next"]);

  const actionItems = dedupeActionItems([
    { text: "Follow up", owner: "Alex" },
    { text: "Follow up", owner: "Alex" },
    { text: "Draft notes" },
  ]);
  assert.equal(actionItems.length, 2);

  assert.equal(
    shouldUpdateSummary({
      now: 100000,
      lastAttemptAt: 98000,
      lastUpdateAt: 98000,
      bufferLength: 2000,
    }),
    false
  );
  assert.equal(
    shouldUpdateSummary({
      now: 100000,
      lastAttemptAt: 70000,
      lastUpdateAt: 70000,
      bufferLength: 10,
    }),
    true
  );

  console.log("All tests passed.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
