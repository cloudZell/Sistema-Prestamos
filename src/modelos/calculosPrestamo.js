// src/modelos/calculosPrestamo.js

function calcularMontoTotal(principal, tasaInteres, plazo) {
    const tasaMensual = tasaInteres / 100 / 12;
    const cuotaMensual = principal * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1);
    const montoTotal = cuotaMensual * plazo;
    return {
        montoTotal: Math.round(montoTotal * 100) / 100,
        cuotaMensual: Math.round(cuotaMensual * 100) / 100,
        interesTotal: Math.round((montoTotal - principal) * 100) / 100
    };
}

function calcularSaldoActual(principal, tasaInteres, plazo, pagosTotales) {
    const { montoTotal } = calcularMontoTotal(principal, tasaInteres, plazo);
    const saldoActual = Math.max(0, montoTotal - pagosTotales);
    return Math.round(saldoActual * 100) / 100;
}

module.exports = {
    calcularMontoTotal,
    calcularSaldoActual
};