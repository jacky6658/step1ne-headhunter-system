/**
 * Circuit Breaker — 外部服務熔斷保護
 *
 * 狀態：CLOSED（正常）→ OPEN（熔斷）→ HALF_OPEN（試探）
 * 連續失敗超過閾值後停止呼叫，等待冷卻後試探一次。
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailure = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`${this.name} circuit is OPEN, service unavailable`);
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      console.log(`🟢 ${this.name} circuit CLOSED (recovered)`);
    }
    this.state = 'CLOSED';
  }

  _onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`🔴 ${this.name} circuit OPEN after ${this.failures} failures`);
    }
  }

  getStatus() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

module.exports = CircuitBreaker;
