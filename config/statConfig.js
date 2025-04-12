module.exports = {
    FB: {
        adColumnNameRegex: /(Название объявления|Назва реклами|Назва оголошення|Ad name)/u,
        spendColumnNameRegex: /(Сумма затрат|Сума витрат|Витрачена сума|Amount spent) \(\w{3}\)/u,
        adStatusColumnNameRegex: /(Показ рекламы|Показ реклами|Ad delivery)/u,
        spendColumnName: 'Сумма затрат',
        adStatusColumnName: 'Статус',
        statusMapping: {
            'active': 'active',
            'inactive': 'stop',
            'not_delivering': 'stop',
            'recently_rejected': 'rjctst',
            'rejected': 'rjctst',
            'pending_review': 'pending',
            'pending_process': 'pending',
        }
    },
    Keitaro: {
        subId: 'SubId',
        origStatus: 'Ориг. статус',
        subId1: 'Sub ID 1',
        subId14: 'Sub ID 14',
        install: 'install',
        new: 'new',
        reg: 'reg',
        dep: 'dep',
        qua: 'qua',
    },
    OneStatFileName: '___oneStat.csv'
}
