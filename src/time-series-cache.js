const _ = require('underscore-plus');

module.exports = class TimeSeriesCache {
    constructor({granularity}){
        if(!granularity || granularity <= 0){
            throw new Error('You must set a millisecond granularity that is greater than zero.');
        }

        this.granularity = granularity;
        this.data = new Map();
    }

    add(candle){
        if(Array.isArray(candle)){
            return candle.forEach(item => this.add(item));
        }

        if(!candle.time_period_start){
            throw new Error('All candles must include a date property.');
        }

        candle.time_period_start = new Date(candle.time_period_start);
        candle.time_period_end = new Date(candle.time_period_end);
        candle.time_open = new Date(candle.time_open);
        candle.time_close = new Date(candle.time_close);
        candle.profile = candle.profile.map(([level, buy, sell]) => [parseFloat(level), parseFloat(buy), parseFloat(sell)]);

        this.data.set(candle.time_period_start.getTime(), candle);
    }

    has(date){
        return this.data.has(this.candle(date));
    }

    available(start, end){
        let time = this.candle(start);
        const endTime = this.candle(end);

        while(time <= endTime){
            if(!this.data.has(time)){
                return false;
            }

            time += this.granularity;
        }

        return true;
    }

    singleton(date){
        return this.data.get(this.candle(date));
    }

    fetch(start, end){
        if(end < start) return [];

        const result = [];
        const stop = this.candle(end);
        let candle = this.candle(start);

        while(candle <= stop){
            if(this.data.has(candle)){
                result.push(this.data.get(candle));
            }

            candle += this.granularity;
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
        if(this.data.size === 0) return null;
        const first = _.min(Array.from(this.data.keys()));
        return this.data.get(first);
    }

    last(){
        if(this.data.size === 0) return null;
        const last = _.max(Array.from(this.data.keys()));
        return this.data.get(last);
    }

    destroy(){
        this.data = null;
    }
}
