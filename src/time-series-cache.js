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

            value.high = Math.max(value.high, value.close);
            value.low = Math.min(value.low, value.close);
            //TODO handle the volume adjustment
        }else{
            console.log(`There was no candle for date`, candle)
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
            if(!this.data.has(time)){
                return false;
            }

            time.setTime(time.getTime() + this.granularity);
        }

        return true;
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

    // async query(start, end){
    //     if(this.throttle){
    //         return;
    //     }
    //
    //     this.throttle = true;
    //     setTimeout(() => this.throttle = false, 1500);
    //
    //
    //     if(this.available(start, end)){
    //         return this.fetch(start, end);
    //     }
    //
    //     //Calculate how many candles we need to fetch and perform the source requests
    //     let candles = Math.ceil((end.getTime() - start.getTime()) / granularity);
    //     let promises = [];
    //
    //     for(let i = 0; i < candles; i += this.maxCandlesFromRequest){
    //         let frameStart = new Date(start.getTime() + (this.maxCandlesFromRequest * granularity * i));
    //         let frameEnd = new Date(start.getTime() + (this.maxCandlesFromRequest * granularity));
    //
    //         if(frameEnd > end){
    //             frameEnd = end;
    //         }
    //
    //         promises.push(this.source({start: frameStart, end: frameEnd, granularity}));
    //     }
    //
    //     let requestsFromSource = await Promise.all(promises);
    //     let result = [];
    //
    //     for(let response of requestsFromSource){
    //         response.sort((a, b) => a.date - b.date);
    //         this.add(response, granularity);
    //         result = result.concat(response);
    //     }
    //
    //     return result;
    // }

    destroy(){
        this.data = null;
    }
}
