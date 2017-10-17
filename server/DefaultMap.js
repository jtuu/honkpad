module.exports = class DefaultMap extends Map{
  constructor(getDefaultValue, ...args){
    super(...args);
    this.getDefaultValue = getDefaultValue;
  }

  get(key){
    if(!this.has(key)){
      this.set(key, this.getDefaultValue());
    }
    return super.get(key);
  }
}
