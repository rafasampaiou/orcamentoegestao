const monthData = { geral_capacity_forecast: 784 };
const budgetData = {};
let baseCap = 0;
if (monthData['geral_capacity_forecast'] !== undefined) {
    baseCap = monthData['geral_capacity_forecast'];
}

const daysInMonth = 31;
let result = {};
result['geral_avail'] = [];
let i = 0;
const id = 'geral_avail';

if (id === 'lazer_avail' || id === 'event_avail' || id === 'geral_avail') {
    result[id][i] = baseCap * daysInMonth;
}
console.log(result['geral_avail'][i]);
