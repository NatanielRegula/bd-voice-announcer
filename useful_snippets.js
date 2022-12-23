//function to use in discord to list all the functions that can be run on an object
function getListOfFunctions(objectToTest) {
  const props = [];
  let obj = objectToTest;

  do {
    props.push(...Object.getOwnPropertyNames(obj));
  } while ((obj = Object.getPrototypeOf(obj)));

  props.sort();

  return props.filter((e, i, arr) => {
    if (e != arr[i + 1] && typeof objectToTest[e] == 'function') return true;
  });
}
