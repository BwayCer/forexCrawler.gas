
gasOrder('kidCount', function (deps) {
    deps.kidCount = {
        run: function () {
            var dbSheet_keyVal = new deps.Gasdb('forexCrawler', 'keyVal');
            var crawlerState = _transferDbTxt(dbSheet_keyVal, 2, 2);
            var tradeStamp = crawlerState.tradeStamp;
            // throw Error 無交易日資料
            var tradeTimeStamping = new deps.timeStamping(new Date(tradeStamp));
            var nowTimeStamping = new deps.timeStamping();
            var isNotTradeDay = tradeTimeStamping.readable('{YMD}')
                !== nowTimeStamping.readable('{YMD}')
            ;

            // 本日非交易日
            if (isNotTradeDay) {
                return;
            }

            var dataInfo = _collectDataApplication();
            _dataPush(dataInfo);
        },
    };

    function _transferDbTxt(dbSheet, row, column) {
        var infoTxt = dbSheet.readRange([row, column]);
        var info = JSON.parse(infoTxt);
        return info;
    }

    function _collectDataApplication() {
        var idx, len;
        var config, report, result, itemCode, currencyHistoryList, forwardFetchDataRow;
        var dbSheet_keyVal = new deps.Gasdb('forexCrawler', 'keyVal');
        var dbSheet_crawlerWork = new deps.Gasdb('forexCrawler', 'crawlerWork');
        var currencyConfig = _transferDbTxt(dbSheet_keyVal, 3, 2);
        var historyInfo = _transferDbTxt(dbSheet_keyVal, 4, 2);
        var spotRateInfoList = _transferDbTxt(dbSheet_crawlerWork, 1, 3);
        var dataInfo = {};

        for (idx = 0, len = currencyConfig.length; idx < len ; idx++) {
            config = currencyConfig[idx];
            itemCode = config.code;
            report = {
                code: itemCode,
                name_zh: config.name_zh,
                name_en: config.name_en,
                tickSize: config.tickSize,
            };
            forwardFetchDataRow = config.forwardFetchDataRow;
            // 無法驗證回傳值可否通過 `JSON.parse` 解析
            try {
                report.spotRateInfo = spotRateInfoList[itemCode];
                currencyHistoryList = historyInfo[itemCode];
                report.historyList = Array.isArray(currencyHistoryList)
                    // `Array.from()` 無法使用
                    ? currencyHistoryList.splice(0)
                    : []
                ;
                report.forwardInfo = forwardFetchDataRow
                    ? _transferDbTxt(dbSheet_crawlerWork, forwardFetchDataRow, 3)
                    : null
                ;
            } catch (err) {
                // empty
            }
            // `result` 不可以為空值
            result = _currencyAssessment(report);
            dataInfo[itemCode] = result;
        }

        return dataInfo;
    }

    /**
     * 貨幣評估。
     *
     * @param {Object} report
     * @param {String} report.code
     * @param {String} report.name_zh
     * @param {String} report.name_en
     * @param {Number} report.tickSize
     * @param {Array} report.historyList
     * @param {*} report.spotRateInfo - 即期價格資訊。 有效值為 `Array`。
     * @param {*} report.forwardInfo - 遠期價格資訊。 有效值為 `Object`。
     * @return {Object}
     * { ok               {Boolean}
     *   isSpotPrice      {Boolean}
     *   isForwardPrice   {Boolean}
     *   name_zh          {String}
     *   name_en          {String}
     *   spotBuy          {String}    即期買入
     *   spotSell         {String}    即期賣出
     *   rsv180           {String}    RSV 60
     *   forward30        {String}    遠期 30
     *   fluctuation30    {String}    漲跌幅 30
     *   forward90        {String}    遠期 90
     *   fluctuation90    {String}    漲跌幅 90
     *   forward180       {String}    遠期 180
     *   fluctuation180   {String}    漲跌幅 180
     *   historyList      {Array}
     *   }
     */
    function _currencyAssessment(report) {
        var code = report.code;
        var result = {
            ok: false,
            isSpotPrice: false,
            isForwardPrice: false,
            name_zh: report.name_zh + '(' + code + ')',
            name_en: report.name_en + '(' + code + ')',
            spotBuy: '-',
            spotSell: '-',
            rsv180: '-',
            forward30: '-',
            fluctuation30: '-',
            forward90: '-',
            fluctuation90: '-',
            forward180: '-',
            fluctuation180: '-',
            historyList: report.historyList,
        };

        _currencyAssessment.pickPriceHandle(
            result,
            report.spotRateInfo,
            report.forwardInfo
        );

        if (result.ok) {
            _currencyAssessment.indexNumberHandle(result);
            _currencyAssessment.tickSizeCut(result, report.tickSize);
        }

        return result;
    }

    _currencyAssessment.pickPriceHandle = function (result, spotRateInfo, forwardInfo) {
        var spotBuy, spotSell, forward30, forward90, forward180;
        var getForwardSell;

        if (Array.isArray(spotRateInfo)) {
            spotBuy = +spotRateInfo[0];
            spotSell = +spotRateInfo[1];
            if (!isNaN(spotBuy) && !isNaN(spotSell)) {
                result.ok = true;
                result.isSpotPrice = true;
                result.spotBuy = spotBuy;
                result.spotSell = spotSell;
            }
        }

        if (forwardInfo && forwardInfo.constructor === Object) {
            getForwardSell = _currencyAssessment.getForwardSell;
            forward30 = getForwardSell(forwardInfo, 30);
            forward90 = getForwardSell(forwardInfo, 90);
            forward180 = getForwardSell(forwardInfo, 180);
            if (!isNaN(forward30)
                && !isNaN(forward90)
                && !isNaN(forward180)
            ) {
                result.isForwardPrice = true;
                result.forward30 = forward30;
                result.forward90 = forward90;
                result.forward180 = forward180;
            }
        }
    };

    _currencyAssessment.getForwardSell = function (forwardInfo, index) {
        var priceInfo = forwardInfo[index];
        return Array.isArray(priceInfo) ? +priceInfo[1] : NaN;
    };

    _currencyAssessment.indexNumberHandle = function (result) {
        var historyList, historyMax, historyMin;
        var perCentHandleList = [];
        var spotSell = result.spotSell;

        if (result.isSpotPrice) {
            historyList = result.historyList;
            historyList.push(spotSell);
            historyList.shift();
            if (historyList.length > 179) {
                historyMax = Math.max.apply(Math, historyList);
                historyMin = Math.min.apply(Math, historyList);
                perCentHandleList.push([
                    'rsv180',
                    spotSell - historyMin,
                    historyMax - historyMin,
                    0,
                ]);
            }
        }

        if (result.isForwardPrice) {
            perCentHandleList.push([
                'fluctuation30',
                result.forward30 - spotSell,
                spotSell,
                2,
            ]);
            perCentHandleList.push([
                'fluctuation90',
                result.forward90 - spotSell,
                spotSell,
                2,
            ]);
            perCentHandleList.push([
                'fluctuation180',
                result.forward180 - spotSell,
                spotSell,
                2,
            ]);
        }

        perCentHandleList.forEach(function (item) {
            result[item[0]] = (item[1] / item[2] * 100).toFixed(item[3]);
        });
    };

    _currencyAssessment.tickSizeCut = function (result, tickSize) {
        var idx, len, val, item;
        var cutItemList = this.cutItemList;
        // `Math.log10` 無法使用
        var fixedLength = Math.abs(Math.round(Math.log(tickSize) / Math.log(10)));

        for (idx = 0, len = cutItemList.length; idx < len ; idx++) {
            item = cutItemList[idx];
            val = result[item];

            // Math.round(0.2 / 0.3 / 0.0001) * 0.0001
            result[item] = typeof val === 'number'
                ? (Math.round(val / tickSize) * tickSize).toFixed(fixedLength)
                : '-'
            ;
        }
    };

    _currencyAssessment.cutItemList = [
        'spotBuy', 'spotSell',
        'forward30', 'forward90', 'forward180',
    ];

    function _dataPush(dataInfo) {
        var idx, len;
        var config, itemCode, data, dbSheet_currency;
        var spotBuy, spotSell, rsv180,
            forward30, fluctuation30,
            forward90, fluctuation90,
            forward180, fluctuation180;
        var dbSheet_keyVal = new deps.Gasdb('forexCrawler', 'keyVal');
        var currencyConfig = _transferDbTxt(dbSheet_keyVal, 3, 2);
        var nowTimeStamping = new deps.timeStamping();
        var nowTimeStampingSymbol = nowTimeStamping.symbol;
        var nowReadableDate = nowTimeStamping.readable('{YMD}');
        var historyInfo = {};
        var tgPushTxtLine = [
            nowReadableDate,
            '// 幣別',
            '//     匯率 | rsv180',
            '//     估30 | 估90 | 估180',
        ];

        for (idx = 0, len = currencyConfig.length; idx < len ; idx++) {
            config = currencyConfig[idx];
            itemCode = config.code;
            dbSheet_currency = new deps.Gasdb('forexCrawler', itemCode);
            data = dataInfo[itemCode];
            spotBuy = data.spotBuy;
            spotSell = data.spotSell;
            rsv180 = data.rsv180;
            forward30 = data.forward30;
            fluctuation30 = data.fluctuation30;
            forward90 = data.forward90;
            fluctuation90 = data.fluctuation90;
            forward180 = data.forward180;
            fluctuation180 = data.fluctuation180;

            historyInfo[itemCode] = data.historyList;

            dbSheet_currency.create([
                nowTimeStampingSymbol, nowReadableDate,
                spotBuy, spotSell, rsv180,
                forward30, fluctuation30,
                forward90, fluctuation90,
                forward180, fluctuation180,
            ]);

            if (data.ok) {
                tgPushTxtLine.push(
                    data.name_zh,
                    '    ' + spotSell + ' | ' + rsv180
                );
                if (data.isForwardPrice) {
                    tgPushTxtLine.push(
                        '    ' + fluctuation30 + '% | '
                        + fluctuation90 + '% | '
                        + fluctuation180 + '%'
                    );
                }
            }
        }

        dbSheet_keyVal.updateRange([4, 2], JSON.stringify(historyInfo));
        deps.tgbot('kidCount - tgBot:child3rd', 'child3rd', 'sendMessage', {
            chat_id: deps._config.tgChatId.babycradle,
            parse_mode: 'Markdown',
            text: tgPushTxtLine.join('\n'),
        });
    }
});

