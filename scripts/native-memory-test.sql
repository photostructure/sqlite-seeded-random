.bail on

CREATE TEMP TABLE assertions (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO assertions VALUES (seeded_random(NULL, 1) IS NULL);
INSERT INTO assertions VALUES (seeded_random(1, NULL) IS NULL);
INSERT INTO assertions
VALUES (seeded_random(42, 1) = seeded_random(42, 1));
INSERT INTO assertions
VALUES (seeded_random(0, 1) != seeded_random(1, 0));

CREATE TEMP TABLE boundary_results AS
SELECT seeded_random(seed, id) AS value
FROM (
  SELECT 0 AS seed, 0 AS id
  UNION ALL SELECT -1, 1
  UNION ALL SELECT 9223372036854775807, -9223372036854775807 - 1
  UNION ALL SELECT -9223372036854775807 - 1, 9223372036854775807
);
INSERT INTO assertions
SELECT count(*) = 4 AND count(value) = 4 FROM boundary_results;

CREATE TEMP TABLE stress_results AS
WITH RECURSIVE sequence(value) AS (
  VALUES (-25000)
  UNION ALL
  SELECT value + 1 FROM sequence WHERE value < 25000
)
SELECT seeded_random(8675309, value) AS value FROM sequence;
INSERT INTO assertions
SELECT count(*) = 50001 AND count(value) = 50001 FROM stress_results;
