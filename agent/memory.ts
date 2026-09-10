import { defineMemory, defineMemoryProvider } from "eve/memory";

export default defineMemory({
  description: "Record whether memory lifecycle callbacks run.",
  scope: () => "capture-repro",
  provider: defineMemoryProvider({
    recall: {
      "turn.started"() {
        console.log("REPRO_RECALL_CALLED");
        return { messages: [] };
      },
    },
    capture: {
      "turn.completed"(ctx) {
        console.log("REPRO_CAPTURE_CALLED", JSON.stringify({ messages: ctx.messages.length }));
      },
    },
  }),
});
