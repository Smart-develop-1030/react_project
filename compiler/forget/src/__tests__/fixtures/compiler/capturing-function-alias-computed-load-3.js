function bar(a, b) {
  let x = [a, b];
  let y = {};
  let t = {};
  (function () {
    y = x[0][1];
    t = x[1][0];
  })();

  return y;
}
