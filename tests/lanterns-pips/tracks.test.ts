// Track + daily suites in one file: they share one worker and run one after
// another (CPU-heavy generation; keeps the parallel test load down).
import "./gentleSuite.ts";
import "./deduceSuite.ts";
import "./dailySuite.ts";
