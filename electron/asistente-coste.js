const TARIFAS = Object.freeze({ 'deepseek-flash': [0.30, 1.20], 'deepseek-v4-pro': [1.32, 3.96] });

function estimar(modelo, uso = {}) {
  const [entrada, salida] = TARIFAS[modelo] || TARIFAS['deepseek-v4-pro'];
  const input = Math.max(0, Number(uso.prompt_tokens) || 0);
  const output = Math.max(0, Number(uso.completion_tokens) || 0);
  return { usd: Number(((input * entrada + output * salida) / 1e6).toFixed(6)), input, output,
    nota: 'Estimación máxima con tarifa pico sin descuento de caché; el cobro real puede ser menor.' };
}

module.exports = { estimar, TARIFAS };
