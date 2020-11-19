class DiceRollBuilder {
  rollFormula(rollFormula) {
    this.rollFormula = rollFormula;
    return this;
  }

  rollParts(rollParts) {
    this.rollParts = rollParts;
    return this;
  }

  rollTotal(rollTotal) {
    this.rollTotal = rollTotal;
    return this;
  }

  build() {
    return new DiceRoll(this.rollFormula, this.rollParts, this.rollTotal);
  }
}
