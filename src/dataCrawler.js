
gasOrder('dataCrawler', function (deps) {
    // 爬蟲狀態管理者
    var _crawlerStateManager = {
        dbSheet: new deps.Gasdb('forexCrawler', 'keyVal'),
        read: function () {
            var crawlerStateTxt = this.dbSheet.readRange([2, 2]);
            return JSON.parse(crawlerStateTxt);
        },
        update: function (newState) {
            return this.dbSheet.updateRange(
                [2, 2],
                JSON.stringify(newState)
            );
        },
    };

    /**
     * @param {Date} assignDate - 指定日。
     * @return {String}
     * `Stop`、`Continue`、`Update`
     */
    _crawlerStateManager.getState = function (assignDate) {
        var tradeStamp, tradeTimeStamping;
        var assignTimeStamping = new deps.timeStamping(assignDate);
        var assignDateTxt = assignTimeStamping.readable('{YMD}');
        var crawlerState = this.read();
        var prevQueryStamp = crawlerState.prevQueryStamp;
        var prevQueryTimeMs = prevQueryStamp
            ? +new Date(prevQueryStamp)
            : 0
        ;
        var diffTimeMs = +assignDate - prevQueryTimeMs;

        // 已在指定日查詢過了
        // 14400000 = 4 * 3600 * 1000
        if (0 <= diffTimeMs && diffTimeMs < 14400000) {
            // 未發生 猜測
            // 如果更新過但交易日不符合預期
            // 可能原因是更新失敗吧
            tradeStamp = crawlerState.tradeStamp;
            if (!tradeStamp) {
                return 'Update';
            }

            tradeTimeStamping = new deps.timeStamping(new Date(tradeStamp));
            // 交易日 == 指定日 則 今日是交易日
            // 有未查詢的項目 則 工作尚未結束
            if (tradeTimeStamping.readable('{YMD}') === assignDateTxt
                && crawlerState.queryNeedList.length
                    !== crawlerState.queryFinishList.length
            ) {
                return 'Continue';
            }
        }
        // 前次查詢日 < 指定日
        else if (14400000 < diffTimeMs) {
            return 'Update';
        }

        return 'Stop';
    };

    /**
     * @param {Date} assignDate - 指定日。
     * @param {Date} tradeDate - 交易日。
     * @return {String}
     * `Stop`、`Continue`、`Update`
     */
    _crawlerStateManager.reset = function (assignDate, tradeDate) {
        var assignTimeStamping = new deps.timeStamping(assignDate);
        var tradeTimeStamping = new deps.timeStamping(tradeDate);
        var crawlerState = this.read();

        crawlerState.prevQueryStamp = assignTimeStamping.symbol;
        crawlerState.tradeStamp = tradeTimeStamping.symbol;
        crawlerState.queryingList = [];
        crawlerState.queryFinishList = [];

        this.update(crawlerState);

        // 顯示 UTC 日期時間
        this.dbSheet.updateRange(
            [1, 2],
            tradeTimeStamping.readable('{YMD}')
        );
    };

    /**
     * @return {Number}
     * @throws {Error} 不符需求的執行項目數量。
     */
    _crawlerStateManager.getQueryKey = function () {
        var idx, val;
        var crawlerState = this.read();
        var queryNeedList = crawlerState.queryNeedList;
        var queryingList = crawlerState.queryingList;
        var queryFinishList = crawlerState.queryFinishList;
        var queryNeedListLength = queryNeedList.length;

        if (queryNeedListLength < queryingList.length
            || queryNeedListLength < queryFinishList.length
        )
            throw Error(deps.juruo.get('_dataCrawler_notMatchingUpAtNeedItem'));

        if (queryNeedListLength === queryFinishList.length)
            return -1;

        for (idx = 0; idx < queryNeedListLength ; idx++) {
            val = queryNeedList[idx];
            if (~queryingList.indexOf(val)) continue;

            queryingList.push(val);
            this.update(crawlerState);
            return val;
        }

        // 所需項目都已被 "執行"，但仍有 "未完成" 項目。
        queryingList = queryFinishList.concat();
        return this.getQueryKey();
    };

    /**
     * @return {Number}
     * @throws {Error} 不存在的需求項目。 (queryKey)
     */
    _crawlerStateManager.record = function (queryKey) {
        var crawlerState = this.read();
        var queryNeedList = crawlerState.queryNeedList;
        var queryFinishList = crawlerState.queryFinishList;

        if (!~queryNeedList.indexOf(queryKey))
            throw Error(
                deps.juruo.get('_dataCrawler_needItemBaffled', {
                    queryKey: queryKey,
                })
            );

        if (~queryFinishList.indexOf(queryKey))
            return;

        queryFinishList.push(queryKey);
        this.update(crawlerState);
    };


    var dataCrawler = deps.dataCrawler = {};

    dataCrawler.run = function (nowArgu) {
        var queryKey, dbSheet;
        var feedInfoTxt, feedInfo, jsonData;
        var now = nowArgu || new Date();
        var state = _crawlerStateManager.getState(now);

        switch (state) {
            case 'Continue':
                dbSheet = new deps.Gasdb('forexCrawler', 'crawlerWork');
                queryKey = _crawlerStateManager.getQueryKey();
                feedInfoTxt = dbSheet.readRange([queryKey, 2]);
                feedInfo = JSON.parse(feedInfoTxt);
                jsonData = this.input(feedInfo);
                dbSheet.updateRange([queryKey, 3], JSON.stringify(jsonData));
                _crawlerStateManager.record(queryKey);
                this.run(now);
                break;
            case 'Update':
                this.runReset();
                this.runExchangeSpotRate(now);
                this.run(now);
                break;
            case 'Stop':
                break;
        }
    };

    dataCrawler.runReset = function () {
        var idx, len;
        var dbSheet = new deps.Gasdb('forexCrawler', 'crawlerWork');
        for (idx = 1, len = dbSheet.RowLast() + 1; idx < len ; idx++) {
            dbSheet.updateRange([idx, 3], '');
        }
    };

    dataCrawler.runExchangeSpotRate = function (nowArgu) {
        var now = nowArgu || new Date();
        var dbSheet = new deps.Gasdb('forexCrawler', 'crawlerWork');
        var feedInfoTxt = dbSheet.readRange([1, 2]);
        var feedInfo = JSON.parse(feedInfoTxt);
        var jsonData = this.input(feedInfo);
        var quoteDate = new Date(jsonData.quoteDateTxt);

        // if (feedInfo.resolve !== 'getExchangeSpotRate') throw Error();

        _crawlerStateManager.reset(now, quoteDate);
        dbSheet.updateRange(
            [1, 3],
            JSON.stringify(jsonData.exchangeRateList)
        );
    };

    var _resolveCache = {};

    /**
     * @param {Object} feedInfo
     */
    dataCrawler.input = function (feedInfo) {
        // 錯誤訊息： 你輸入的內容已超過每個儲存格 50000 字元的上限。
        var fhrData = deps.webRecorder.fetch(
            'dataCrawler - ' + feedInfo.resolve,
            feedInfo.url, feedInfo.options,
            'Text', 'NotShow'
        );
        var jsonData = _resolveCache[feedInfo.resolve](
            fhrData.info.getContentText()
        );

        return jsonData;
    };

    /**
     * 取得即期匯率
     */
    _resolveCache.getExchangeSpotRate = function (content) {
        var narrowDownRegex = /^[\s\S]*?<main[\s\S]*?>[\s\S]*?(<span class="time">[\s\S]+?<\/span>)[\s\S]*?(<table[\s\S]+?>[\s\S]+?<\/table>)[\s\S]*?<\/main>[\s\S]*?$/;
        // `[^>]*?` 作用也不大，因為後面有 `.*?`
        // var exchangeRateRegex = /<td[^>]*?幣別[^>]*?>.*?<div[^>]*?print_show[^>]*?>[^<]*?\((\w+)\)[^<]*?<\/div>.*?<\/td>[^<]*?(?:<td[^>]*?>[^<]*?<\/td>[^<]*?){2}<td[^>]*?>[^<]*?(\d+(?:\.\d+)?)[^<]*?<\/td>[^<]*?<td[^>]*?>[^<]*?(\d+(?:\.\d+)?)[^<]*?<\/td>/g;
        var quoteTimeRegex = /^[\s\S]*?<span class="time">([\s\S]+?)<\/span>[\s\S]*?$/;
        var tableTrRegex = /<tr>.+?<\/tr>/g;
        var tableTdRegex = /<td.*?>.+?<\/td>/g;
        var currencyRegex = /\((\w+)\)/;
        var numberRegex = /(\d+(?:\.\d+)?)/;
        var handleTxt = content
            .replace(narrowDownRegex, '$1$2')
            .replace(/\s+/g, ' ')
        ;
        var quoteDateTxt = handleTxt.replace(quoteTimeRegex, '$1');
        var exchangeRateList = (handleTxt.match(tableTrRegex) || [])
            .reduce(function (exchangeRateList, tableTrTxt) {
                var idx, val;

                var matchTd = tableTrTxt.match(tableTdRegex);
                if (!matchTd) return exchangeRateList;

                var matchCurrency = matchTd[0].match(currencyRegex);
                if (!matchCurrency) return exchangeRateList;

                var rateList = [];
                for (idx = 3; idx < 5 ; idx++) {
                    val = matchTd[idx].match(numberRegex);
                    if (!val) return exchangeRateList;
                    rateList.push(val[0]);
                }

                exchangeRateList[matchCurrency[1]] = rateList;
                return exchangeRateList;
            }, {})
        ;

        return {
            quoteDateTxt: quoteDateTxt,
            exchangeRateList: exchangeRateList,
        };
    };

    /**
     * 遠期匯率
     */
    _resolveCache.getExchangeForwardRate = function (content) {
        var narrowDownRegex = /^[\s\S]*?<main[\s\S]*?>[\s\S]*?(<table[\s\S]+?>[\s\S]+?<\/table>)[\s\S]*?<\/main>[\s\S]*?$/;
        var tableTrRegex = /<tr>.+?<\/tr>/g;
        var tableTdRegex = /<td.*?>.+?<\/td>/g;
        var dayRegex = /(\d+)/;
        var numberRegex = /(\d+(?:\.\d+)?)/;
        var handleTxt = content
            .replace(narrowDownRegex, '$1')
            .replace(/\s+/g, ' ')
        ;
        var exchangeRateList = (handleTxt.match(tableTrRegex) || [])
            .reduce(function (exchangeRateList, tableTrTxt) {
                var idx, val;

                var matchTd = tableTrTxt.match(tableTdRegex);
                if (!matchTd) return exchangeRateList;

                var matchDay = matchTd[0].match(dayRegex);
                if (!matchDay) return exchangeRateList;

                var rateList = [];
                for (idx = 1; idx < 3 ; idx++) {
                    val = matchTd[idx].match(numberRegex);
                    if (!val) return exchangeRateList;
                    rateList.push(val[0]);
                }

                exchangeRateList[matchDay[1]] = rateList;
                return exchangeRateList;
            }, {})
        ;

        return exchangeRateList;
    };
});

