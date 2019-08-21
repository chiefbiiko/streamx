import { test, runIfMain } from "https://deno.land/std/testing/mod.ts";
import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { fromUint8Array } from "https://deno.land/x/base64/mod.ts";
import { Readable, Writable, Transform } from "./mod.js";

test({
  name: "simple transform binary-to-text stream",
  fn() {
    return new Promise(resolve => {
      new Transform({
        transform(chunk, cb) {
          this.push(fromUint8Array(chunk));
          cb(null);
        }
      })
        .on("data", chunk => {
          assertEquals(typeof chunk, "string");
          assertEquals(chunk.length, 12);

          resolve();
        })
        .write(new Uint8Array(8));
    });
  }
});

test({
  name: "streams are async iterators",
  async fn() {
    const data = ["a", "b", "c", null];
    const expected = data.slice(0);

    const r = new Readable({
      read(cb) {
        this.push(data.shift());
        cb(null);
      }
    });

    for await (const chunk of r) {
      assertEquals(chunk, expected.shift());
    }

    assertEquals(expected, [null]);
  }
});

test({
  name: "ondata",
  fn() {
    return new Promise(resolve => {
      const r = new Readable();

      const buffered = [];
      let ended = 0;

      r.push("hello");
      r.push("world");
      r.push(null);

      r.on("data", data => buffered.push(data));
      r.on("end", () => ended++);
      r.on("close", function() {
        assertEquals(buffered, ["hello", "world"]);
        assertEquals(ended, 1);
        assert(r.destroyed);

        resolve();
      });
    });
  }
});

test({
  name: "resume",
  fn() {
    return new Promise(resolve => {
      const r = new Readable();
      let ended = 0;

      r.push("hello");
      r.push("world");
      r.push(null);

      r.resume();
      r.on("end", () => ended++);
      r.on("close", function() {
        assertEquals(ended, 1);
        assert(r.destroyed);

        resolve();
      });
    });
  }
});

test({
  name: "shorthands",
  fn() {
    return new Promise(resolve => {
      const r = new Readable({
        read(cb) {
          this.push("hello");
          cb(null);
        },
        destroy(cb) {
          cb(null);
        }
      });

      r.once("readable", function() {
        assertEquals(r.read(), "hello");
        assertEquals(r.read(), "hello");

        r.destroy();

        assertEquals(r.read(), null);

        resolve();
      });
    });
  }
});

test({
  name: "both push and the cb needs to be called for re-reads",
  fn() {
    return new Promise(resolve => {
      let once = true;

      const r = new Readable({
        read(cb) {
          assert(once);
          once = false;
          cb(null);

          if (!once) {
            resolve();
          }
        }
      });

      r.resume();

      setTimeout(function() {
        once = true;
        r.push("hi");
      }, 100);
    });
  }
});

test({
  name: "opens before writes",
  fn() {
    return new Promise(resolve => {
      const trace = [];

      const stream = new Writable({
        open(cb) {
          trace.push("open");
          cb(null);
        },
        write(data, cb) {
          trace.push("write");
          cb(null);
        }
      });

      stream.on("close", () => {
        assertEquals(trace.length, 2);
        assertEquals(trace[0], "open");

        resolve();
      });

      stream.write("data");
      stream.end();
    });
  }
});

test({
  name: "pipe with callback - error case",
  fn() {
    return new Promise(resolve => {
      const r = new Readable();

      const w = new Writable({
        write(data, cb) {
          cb(new Error("blerg"));
        }
      });

      r.pipe(
        w,
        function(err) {
          assertEquals(err, new Error("blerg"));

          resolve();
        }
      );

      r.push("hello");
      r.push("world");
      r.push(null);
    });
  }
});

test({
  name: "pipe with callback - error case with destroy",
  fn() {
    return new Promise(resolve => {
      const r = new Readable();

      const w = new Writable({
        write(data, cb) {
          w.destroy(new Error("blerg"));
          cb(null);
        }
      });

      r.pipe(
        w,
        function(err) {
          assertEquals(err, new Error("blerg"));

          resolve();
        }
      );

      r.push("hello");
      r.push("world");
    });
  }
});

test({
  name: "simple pipe",
  fn() {
    return new Promise(resolve => {
      const buffered = [];

      const r = new Readable();

      const w = new Writable({
        write(data, cb) {
          buffered.push(data);
          cb(null);
        },

        final() {
          assertEquals(buffered, ["hello", "world"]);

          resolve();
        }
      });

      r.pipe(w);

      r.push("hello");
      r.push("world");
      r.push(null);
    });
  }
});

test({
  name: "pipe with callback",
  fn() {
    return new Promise(resolve => {
      const buffered = [];

      const r = new Readable();

      const w = new Writable({
        write(data, cb) {
          buffered.push(data);
          cb(null);
        }
      });

      r.pipe(
        w,
        function(err) {
          assertEquals(err, null);
          assertEquals(buffered, ["hello", "world"]);

          resolve();
        }
      );

      r.push("hello");
      r.push("world");
      r.push(null);
    });
  }
});

runIfMain(import.meta, { parallel: true });
