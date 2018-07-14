const _ = require('underscore-plus');

module.exports = class TimeSeriesCache {
    constructor({granularity}){
        if(!granularity || granularity <= 0){
            throw new Error('You must set a millisecond granularity that is greater than zero.');
        }

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

        //Set all following empty candles to the designated close price
        //This method of setting empty candles is certainly not perfect, but it's good enough for now
        if(data.trades_count){
            let timestamp = data.date.getTime() + this.granularity;
            let next = this.data.get(timestamp);

            while(next && next.trades_count === 0){
                next.high = data.close;
                next.low = data.close;
                next.open = data.close;
                next.close = data.close;

                timestamp += this.granularity;
                next = this.data.get(timestamp);
            }
        }else{
            let previous = this.data.get(data.date.getTime() - this.granularity);

            if(previous){
                data.high = previous.close;
                data.low = previous.close;
                data.open = previous.close;
                data.close = previous.close;
            }
        }
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
            value.volume_traded += data.size;
            value.volume_notional += (data.size * data.price);
            value.trades_count += 1;
        }else{
            if(via.devMode) console.log(`There was no candle for date`, candle);
            this.add({
                date: data.date,
                low: data.price,
                high: data.price,
                open: data.price,
                close: data.price,
                volume_traded: data.size,
                volume_notional: (data.size * data.price),
                trades_count: 1
            });
        }
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
