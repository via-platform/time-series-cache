const _ = require('underscore-plus');

module.exports = class TimeSeriesCache {
    constructor({granularity}){
        this.granularity = granularity;
        this.data = new Map();
        this.skyline = [];
    }

    add(data){
        if(Array.isArray(data)){
            return data.forEach(item => this.add(item));
        }

        if(!data.date){
            throw new Error('All data points must include a date property.');
        }

        data.date = this.nearestCandle(data.date);
        this.data.set(data.date.getTime(), data);
    }

    update(data){
        const candle = this.candle(data.date);

        if(this.data.has(candle)){
            const value = this.data.get(candle);

            if(data.price){
                value.close = data.price;
            }

            value.high = value.high ? Math.max(value.high, value.close) : value.close;
            value.low = value.low ? Math.min(value.low, value.close) : value.close;
            value.volume += data.size;
            value.trades += 1;
        }else{
            if(via.devMode) console.log(`There was no candle for date`, candle);
            this.add({date: data.date, low: data.price, high: data.price, open: data.price, close: data.price, volume: data.size, trades: 1});
        }
    }

    has(date){
        return this.data.has(this.candle(date));
    }

    available(start, end){
        const time = this.nearestCandle(start);
        const endTime = this.nearestCandle(end);

        while(time <= endTime){
            if(!this.data.has(time.getTime())){
                return false;
            }

            time.setTime(time.getTime() + this.granularity);
        }

        return true;
    }

    singleton(date){
        return this.data.get(this.candle(date));
    }

    fetch(start, end){
        const result = [];

        //NOTE: If performance requires, this could be rewritten to iterate over all candles between `start` and `end`, rather than over `n`.

        for(const datum of this.data.values()){
            if(datum.date >= start && datum.date <= end){
                result.push(datum);
            }
        }

        return result;
    }

    candle(date){
        return this.nearestCandle(date).getTime();
    }

    nearestCandle(date){
        return new Date(Math.floor(date.getTime() / this.granularity) * this.granularity);
    }

    first(){
        let first = null;

        for(const datum of this.data.values()){
            if(!first || first.date > datum.date){
                first = datum;
            }
        }

        return first;
    }

    last(){
        let last = null;

        for(const datum of this.data.values()){
            if(!last || last.date < datum.date){
                last = datum;
            }
        }

        return last;
    }

    destroy(){
        this.data = null;
    }
}
