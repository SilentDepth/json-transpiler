/**
 * Parse a key path expression for an object
 * @param obj {object}
 * @param path {string}
 * @param makeCrumbs {boolean} To add non-exist middle property
 * @returns {{parent: *, key: string}}
 */

function parser(obj, path, makeCrumbs = false) {


  let parent = obj;
  let key = '';
  let tokens = path.split('.');
  let len = tokens.length;
  let isArray;
  let arrIdx;

  tokens.forEach((token, idx) => {
    [, key, isArray, arrIdx] = /(.+?)(\[(\d+)?])?$/.exec(token);

    if (isArray) {
      if (makeCrumbs && !(parent[key] instanceof Array)) {
        parent[key] = [];
      }
      parent = parent[key];
      key = arrIdx || parent.length;
    }

    if (idx < len - 1) {
      if (makeCrumbs && !parent[key]) {
        parent[key] = {};
      }
      parent = parent[key];
    }
  });

  if (parent) {
    return {parent, key};
  }
}

function getter(source, sourceKey) {
  let key = sourceKey;
  let needIteration = false;

  if (/\[]$/.test(key)) {
    needIteration = true;
    key = key.slice(0, -2);
  }

  let pathObj = parser(source, key);

  if (pathObj) {
    return {
      needIteration,
      value: pathObj.parent[pathObj.key],
    };
  }
}

function setter(target, targetKey, value = null, setUndefined = false) {
  if (value === undefined) {
    if (!setUndefined) {
      return;
    }
  } else {
    if (typeof targetKey === 'function') {
      let result = targetKey(value);
      if (result === undefined) {
        return
      }
      ({key: targetKey, value} = result);
    } else if (/^!/.test(targetKey)) {
      value = ['1', 'true', 'yes', 't', 'y'].indexOf(('' + value).toLowerCase()) >= 0;
      if (/^!!/.test(targetKey)) {
        targetKey = targetKey.slice(2);
      } else {
        targetKey = targetKey.slice(1);
        value = !value;
      }
    } else if (/^\+/.test(targetKey)) {
      targetKey = targetKey.slice(1);
      value = +value;
    }
  }

  let pathObj = parser(target, targetKey, true);
  pathObj.parent[pathObj.key] = value instanceof Object ? JSON.parse(JSON.stringify(value)) : value;
}

const CONFIG_KEY = '__json-refactor__';

function jsonRefactor(source, map, target = {}) {
  const {setUndefined = false} = map[CONFIG_KEY] || {};

  // TODO: parameters validation

  const mapKeys = Reflect.ownKeys(map).filter(key => key !== CONFIG_KEY);
  mapKeys.forEach(sourceKey => {
    let got = getter(source, sourceKey);
    if (got.value === undefined && !setUndefined) return;
    if (got.needIteration) {
      got.value.forEach(source => {
        let refactored = jsonRefactor(source, map[sourceKey].map);
        setter(target, map[sourceKey].key, refactored, setUndefined);
      });
    } else {
      setter(target, map[sourceKey], got.value, setUndefined);
    }
  });

  return target;
}

export default jsonRefactor;
