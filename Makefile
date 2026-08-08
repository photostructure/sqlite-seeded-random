CC ?= gcc

ifeq ($(shell uname -s),Darwin)
  LOADABLE_EXTENSION=dylib
  LDFLAGS += -undefined dynamic_lookup
else ifeq ($(OS),Windows_NT)
  LOADABLE_EXTENSION=dll
else
  LOADABLE_EXTENSION=so
endif

prefix=dist
$(prefix):
	mkdir -p $(prefix)

TARGET_LOADABLE=$(prefix)/seeded_random.$(LOADABLE_EXTENSION)

loadable: $(TARGET_LOADABLE)
all: loadable

$(TARGET_LOADABLE): seeded_random.c vendor/sqlite3ext.h $(prefix)
	$(CC) -fPIC -shared -fvisibility=hidden \
		-Wall -Wextra -Werror -pedantic \
		-Ivendor/ -O3 \
		$(CFLAGS) $< -o $@ $(LDFLAGS)

clean:
	rm -rf $(prefix)

test: loadable
	npm test

check-memory:
	npm run check:memory

# Every PhotoStructure repo exposes `make preflight`: run everything that should
# pass before cutting a release -- update dependencies, format, lint, compile,
# test, and run native memory analysis. The steps are defined in package.json.
preflight:
	npm run preflight

.PHONY: all loadable clean test check-memory preflight
