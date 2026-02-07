import { DatabaseSync } from "@photostructure/sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

// Build the extension at module load time
const projectRoot = path.resolve(__dirname, "..");

const ext =
  process.platform === "win32"
    ? "dll"
    : process.platform === "darwin"
      ? "dylib"
      : "so";
const candidatePath = path.join(projectRoot, "dist", `seeded_random.${ext}`);
const extensionPath = fs.existsSync(candidatePath) ? candidatePath : undefined;

const describeExtension = extensionPath ? describe : describe.skip;

function openWithExtension(): InstanceType<typeof DatabaseSync> {
  const db = new DatabaseSync(":memory:", {
    allowExtension: true,
    readBigInts: true,
  });
  db.enableLoadExtension(true);
  db.loadExtension(extensionPath!);
  db.enableLoadExtension(false);
  return db;
}

describeExtension("seeded_random", () => {
  let db: InstanceType<typeof DatabaseSync>;

  beforeEach(() => {
    db = openWithExtension();
  });

  afterEach(() => {
    db.close();
  });

  describe("determinism", () => {
    test("same inputs produce same output", () => {
      const r1 = db.prepare("SELECT seeded_random(42, 1) as v").get() as Record<
        string,
        bigint
      >;
      const r2 = db.prepare("SELECT seeded_random(42, 1) as v").get() as Record<
        string,
        bigint
      >;
      expect(r1.v).toBe(r2.v);
    });

    test("result is a non-zero bigint", () => {
      const r = db.prepare("SELECT seeded_random(42, 1) as v").get() as Record<
        string,
        bigint
      >;
      expect(typeof r.v).toBe("bigint");
      expect(r.v).not.toBe(0n);
    });
  });

  describe("NULL propagation", () => {
    test("NULL seed returns NULL", () => {
      const r = db
        .prepare("SELECT seeded_random(NULL, 1) as v")
        .get() as Record<string, unknown>;
      expect(r.v).toBeNull();
    });

    test("NULL id returns NULL", () => {
      const r = db
        .prepare("SELECT seeded_random(1, NULL) as v")
        .get() as Record<string, unknown>;
      expect(r.v).toBeNull();
    });

    test("both NULL returns NULL", () => {
      const r = db
        .prepare("SELECT seeded_random(NULL, NULL) as v")
        .get() as Record<string, unknown>;
      expect(r.v).toBeNull();
    });
  });

  describe("seed/id asymmetry", () => {
    test("seeded_random(0, 1) != seeded_random(1, 0)", () => {
      const r1 = db.prepare("SELECT seeded_random(0, 1) as v").get() as Record<
        string,
        bigint
      >;
      const r2 = db.prepare("SELECT seeded_random(1, 0) as v").get() as Record<
        string,
        bigint
      >;
      expect(r1.v).not.toBe(r2.v);
    });
  });

  describe("different seeds produce different orderings", () => {
    test("seed 1 vs seed 2 over 1000 rows", () => {
      db.exec(
        "CREATE TABLE t(id INTEGER PRIMARY KEY); " +
          "WITH RECURSIVE seq(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM seq WHERE x<1000) " +
          "INSERT INTO t SELECT x FROM seq;",
      );

      const order1 = db
        .prepare("SELECT id FROM t ORDER BY seeded_random(1, id) LIMIT 20")
        .all() as Array<Record<string, bigint>>;
      const order2 = db
        .prepare("SELECT id FROM t ORDER BY seeded_random(2, id) LIMIT 20")
        .all() as Array<Record<string, bigint>>;

      const ids1 = order1.map((r) => r.id);
      const ids2 = order2.map((r) => r.id);
      expect(ids1).not.toEqual(ids2);
    });
  });

  describe("ORDER BY stability", () => {
    test("same seed produces identical ordering across calls", () => {
      db.exec(
        "CREATE TABLE t(id INTEGER PRIMARY KEY); " +
          "WITH RECURSIVE seq(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM seq WHERE x<1000) " +
          "INSERT INTO t SELECT x FROM seq;",
      );

      const order1 = db
        .prepare("SELECT id FROM t ORDER BY seeded_random(42, id)")
        .all() as Array<Record<string, bigint>>;
      const order2 = db
        .prepare("SELECT id FROM t ORDER BY seeded_random(42, id)")
        .all() as Array<Record<string, bigint>>;

      expect(order1).toEqual(order2);
    });
  });

  describe("statistical quality", () => {
    /**
     * Chi-squared test: bin bigint outputs into buckets and check uniformity.
     * Returns the p-value.
     */
    function chiSquaredUniformity(
      values: bigint[],
      numBuckets: number,
    ): number {
      const buckets = new Array(numBuckets).fill(0);
      const bigBuckets = BigInt(numBuckets);
      for (const v of values) {
        // Use absolute value mod numBuckets for bucketing
        const abs = v < 0n ? -v : v;
        const idx = Number(abs % bigBuckets);
        buckets[idx]++;
      }

      const expected = values.length / numBuckets;
      let chiSq = 0;
      for (const count of buckets) {
        chiSq += (count - expected) ** 2 / expected;
      }

      // Approximate p-value using normal approximation to chi-squared.
      // For large df, chi-squared ~ N(df, 2*df).
      const df = numBuckets - 1;
      const z = (chiSq - df) / Math.sqrt(2 * df);
      const p = 0.5 * (1 - erf(z / Math.sqrt(2)));
      return p;
    }

    /** Error function approximation (Abramowitz & Stegun 7.1.26) */
    function erf(x: number): number {
      const sign = x >= 0 ? 1 : -1;
      const a = Math.abs(x);
      const t = 1 / (1 + 0.3275911 * a);
      const y =
        1 -
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
          0.284496736) *
          t +
          0.254829592) *
          t *
          Math.exp(-a * a);
      return sign * y;
    }

    test("sequential IDs are well-distributed (10000 IDs, 100 buckets)", () => {
      db.exec(
        "CREATE TABLE t(id INTEGER PRIMARY KEY); " +
          "WITH RECURSIVE seq(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM seq WHERE x<10000) " +
          "INSERT INTO t SELECT x FROM seq;",
      );

      const rows = db
        .prepare("SELECT seeded_random(42, id) as v FROM t")
        .all() as Array<Record<string, bigint>>;
      const values = rows.map((r) => r.v);

      const pValue = chiSquaredUniformity(values, 100);
      expect(pValue).toBeGreaterThan(0.01);
    });

    test("sparse IDs are well-distributed", () => {
      const sparseIds = [
        1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61,
        67, 71, 73, 79, 83, 89, 97, 100, 128, 256, 500, 512, 1000, 1024, 2000,
        2048, 4096, 5000, 8192, 10000, 10001, 16384, 32768, 50000, 65536,
        100000, 131072, 262144, 500000, 524288, 1000000,
      ];

      db.exec("CREATE TABLE t(id INTEGER PRIMARY KEY)");
      const insert = db.prepare("INSERT OR IGNORE INTO t(id) VALUES(?)");
      for (let i = 0; i < 200; i++) {
        for (const id of sparseIds) {
          insert.run(id + i * 1000000);
        }
      }

      const rows = db
        .prepare("SELECT seeded_random(42, id) as v FROM t")
        .all() as Array<Record<string, bigint>>;
      const values = rows.map((r) => r.v);

      const pValue = chiSquaredUniformity(values, 50);
      expect(pValue).toBeGreaterThan(0.01);
    });

    test("100k outputs binned into 100 buckets pass chi-squared", () => {
      db.exec(
        "CREATE TABLE t(id INTEGER PRIMARY KEY); " +
          "WITH RECURSIVE seq(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM seq WHERE x<100000) " +
          "INSERT INTO t SELECT x FROM seq;",
      );

      const rows = db
        .prepare("SELECT seeded_random(7, id) as v FROM t")
        .all() as Array<Record<string, bigint>>;
      const values = rows.map((r) => r.v);

      const pValue = chiSquaredUniformity(values, 100);
      expect(pValue).toBeGreaterThan(0.01);
    });
  });

  describe("edge cases", () => {
    test("seed=0, id=0 works", () => {
      const r = db.prepare("SELECT seeded_random(0, 0) as v").get() as Record<
        string,
        bigint
      >;
      expect(typeof r.v).toBe("bigint");
    });

    test("seed=0 works", () => {
      const r = db.prepare("SELECT seeded_random(0, 1) as v").get() as Record<
        string,
        bigint
      >;
      expect(typeof r.v).toBe("bigint");
    });

    test("negative seed works", () => {
      const r = db.prepare("SELECT seeded_random(-1, 1) as v").get() as Record<
        string,
        bigint
      >;
      expect(typeof r.v).toBe("bigint");
    });

    test("negative id works", () => {
      const r = db
        .prepare("SELECT seeded_random(42, -100) as v")
        .get() as Record<string, bigint>;
      expect(typeof r.v).toBe("bigint");
    });

    test("large values work", () => {
      const r = db
        .prepare(
          "SELECT seeded_random(9223372036854775807, 9223372036854775807) as v",
        )
        .get() as Record<string, bigint>;
      expect(typeof r.v).toBe("bigint");
    });

    test("float arguments are coerced to integer", () => {
      const rFloat = db
        .prepare("SELECT seeded_random(42, 3.7) as v")
        .get() as Record<string, bigint>;
      const rInt = db
        .prepare("SELECT seeded_random(42, 3) as v")
        .get() as Record<string, bigint>;
      // SQLite coerces 3.7 to 3 via sqlite3_value_int64
      expect(rFloat.v).toBe(rInt.v);
    });

    test("string arguments are coerced", () => {
      const rStr = db
        .prepare("SELECT seeded_random(42, '5') as v")
        .get() as Record<string, bigint>;
      const rInt = db
        .prepare("SELECT seeded_random(42, 5) as v")
        .get() as Record<string, bigint>;
      // SQLite coerces '5' to 5 via sqlite3_value_int64
      expect(rStr.v).toBe(rInt.v);
    });
  });
});

describeExtension("JS wrapper", () => {
  // These tests require the tsup build to have run (npm run build:js)
  let mod: typeof import("../src/index");

  beforeAll(async () => {
    // Load the CJS build output
    mod = require(path.join(projectRoot, "dist", "index.js"));
  });

  test("getLoadablePath returns a path that exists", () => {
    const p = mod.getLoadablePath();
    expect(fs.existsSync(p)).toBe(true);
  });

  test("getLoadablePath returns a path ending with the platform extension", () => {
    const p = mod.getLoadablePath();
    const ext =
      process.platform === "win32"
        ? ".dll"
        : process.platform === "darwin"
          ? ".dylib"
          : ".so";
    expect(p).toMatch(new RegExp(`seeded_random\\${ext}$`));
  });

  test("load() successfully loads the extension", () => {
    const db = new DatabaseSync(":memory:", {
      allowExtension: true,
      readBigInts: true,
    });
    db.enableLoadExtension(true);
    mod.load(db);
    db.enableLoadExtension(false);

    const r = db.prepare("SELECT seeded_random(42, 1) as v").get() as Record<
      string,
      bigint
    >;
    expect(typeof r.v).toBe("bigint");
    db.close();
  });
});
