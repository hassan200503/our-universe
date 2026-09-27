import { randomInt } from "node:crypto";

// 64 friendly words → 4 words + 2 digits ≈ 1.7 billion combinations; with bcrypt
// (cost 12) and the login throttle that is far beyond practical guessing.
const WORDS = (
  "amber river cedar falcon meadow lantern harbor willow summit ember orchid canyon maple heron coral tundra " +
  "acacia savanna baobab kestrel lotus marble velvet comet aurora prairie glacier sparrow jasmine pebble " +
  "thunder violet saffron copper lagoon hazel quartz breeze ivory juniper nectar oasis poppy raven sable " +
  "tulip umber walnut zephyr bramble crimson dune fern garnet indigo jade kelp lilac mango nova opal plume"
).split(" ");

export function passphrase(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  return `${w()}-${w()}-${w()}-${w()}-${randomInt(10, 100)}`;
}
