import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

export default defineAgent({ model: mockModel("Acknowledged."), modelContextWindowTokens: 100000 });
