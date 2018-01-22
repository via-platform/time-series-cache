const _ = require('underscore-plus');

module.exports = class TimeSeriesCache {
    constructor({granularity}){
        this.granularity = granularity;
        this.data = new Map();
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
        let candle = this.candle(data.date);

        if(this.data.has(candle)){
            let value = this.data.get(candle);

            if(data.price){
                value.close = data.price;
            }

            value.high = value.high ? Math.max(value.high, value.close) : value.close;
            value.low = value.low ? Math.min(value.low, value.close) : value.close;
            //TODO handle the volume adjustment
        }else{
            if(via.devMode){
                console.log(`There was no candle for date`, candle);
            }
            //TODO possible save this ticker event for later application, once a candle is added for this date
            // this.add([{date: candle, low: current.price, high: current.price, open: current.price, close: current.price, volume: 0}]);
        }
    }

    has(date){
        return this.data.has(this.candle(date));
    }

    available(start, end){
        let time = this.nearestCandle(start);
        let endTime = this.nearestCandle(end);

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
        let result = [];

        for(let datum of this.data.values()){
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

        for(let datum of this.data.values()){
            if(!first || first.date > datum.date){
                first = datum;
            }
        }

        return first;
    }

    last(){
        let last = null;

        for(let datum of this.data.values()){
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
