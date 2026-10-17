// Custom/minimal Phaser 3.90 build: phaser-core (no physics/tilemaps/bitmaptext…),
// Canvas renderer only, no Phaser sound. Flags are resolved in vite.config.ts.
// Types still come from the full `phaser` typings.
import type PhaserTypes from "phaser";
// @ts-expect-error untyped CommonJS source entry of the custom build
import PhaserCore from "phaser/src/phaser-core.js";
// phaser-core omits Container; register its factory (self-registering side effect).
import "phaser/src/gameobjects/container/ContainerFactory.js";

const Phaser = PhaserCore as typeof PhaserTypes;
export default Phaser;
