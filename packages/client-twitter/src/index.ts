import { TwitterClientInterface } from "./client";

const twitterPlugin = {
    name: "twitter",
    description: "Twitter client",
    clients: [TwitterClientInterface],
};

export { TwitterClientInterface };
export default twitterPlugin;
