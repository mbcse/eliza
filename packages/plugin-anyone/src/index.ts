import { startAnyone } from "./actions/startAnyone";
import { stopAnyone } from "./actions/stopAnyone";

export const anyonePlugin = {
    name: "anyone",
    description: "Proxy requests through Anyone",
    actions: [startAnyone, stopAnyone],
};
