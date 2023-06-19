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

function searchByAnything(str) {
  let r;
  r =
    ZLibrary.WebpackModules.getByProps(str) ??
    ZLibrary.WebpackModules.getByString(str) ??
    ZLibrary.WebpackModules.getByPrototypes(str) ??
    ZLibrary.WebpackModules.getByDisplayName(str) ??
    ZLibrary.WebpackModules.getByRegex(str);
  try {
    r = ZLibrary.WebpackModules.getByIndex(str);
  } catch (error) {}
  return r;
}
function findModulesByName(name) {
  return BdApi.findAllModules(
    (e) =>
      e &&
      Object.keys(e).some(
        (k) => k.toLowerCase().indexOf(name.toLowerCase()) > -1
      )
  );
}

function findModulesByKeyword(keyword) {
  return BdApi.findAllModules((m) =>
    Object.keys(m).some((k) => k.toLowerCase().includes(keyword))
  );
}
