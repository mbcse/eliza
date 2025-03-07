import type { Plugin } from "@elizaos/core";
import { routeAction } from "./actions/ensoRoute";

export const ensoPlugin: Plugin = {
  name: "enso",
  description: "",
  providers: [],
  evaluators: [],
  services: [],
  actions: [routeAction],
};
