// const {Emitter, Disposable, CompositeDisposable} = require('event-kit');
// const _ = require('underscore-plus');

module.exports = class TimeSeriesCache {
    constructor(params = {}){
        //TODO make sure incoming query requests are not looking for a finer resolution than this
        this.resolution = params.resolution;
        this.source = params.source;
        this.maxCandlesFromRequest = params.maxCandlesFromRequest;
        this.skyline = {};
        this.data = {};
        this.emitter = new Emitter();
        this.live = false;
    }

    merge(ranges){
        if(!ranges.length){
            return [];
        }

        let stack = [];
        ranges.sort((a, b) => a.start - b.start);
        stack.push(_.first(ranges));

        for(let range of ranges.slice(1)){
            let top = _.last(stack);

            if (top.end < range.start) {
                stack.push(range);
            } else if (top.end < range.end) {
                top.end = range.end;
            }
        }

        return stack;
    }

    add(data, granularity){
        if(!data.length){
            return;
        }

        for(let datum of data){
            if(!datum.date){
                throw new Error('All data points must include a date property.');
            }
        }

        let start = _.first(data).date;
        let end = _.last(data).date;

        if(this.available(start, end, granularity)){
            return;
        }


        if(!this.skyline.hasOwnProperty(granularity)){
            this.skyline[granularity] = [];
        }

        let candles = (this.data[granularity] || []).slice();
        let result = [];

        while(candles.length && data.length){
            let candle = _.first(candles).date;
            let datum = _.first(data).date;

            if(candle > datum){
                result.push(data.shift());
            }else if(datum < candle){
                result.push(candles.shift());
            }else{
                result.push(data.shift());
                candles.shift();
            }
        }

        result = result.concat(candles, data);

        this.data[granularity] = result;

        this.skyline[granularity].push({start, end});
        this.skyline[granularity] = this.merge(this.skyline[granularity]);

        this.emitter.emit('did-modify-data');
    }

    available(start, end, granularity){
        for(let grain of Object.keys(this.skyline).sort()){
            if(grain <= granularity && granularity % grain === 0){
                for(let range of this.skyline[grain]){
                    if(range.start <= start && range.end >= end){
                        return true;
                    }
                }
            }
        }

        return false;
    }

    combine(data, grain, granularity){
        if(grain === granularity){
            return data;
        }

        let factor = granularity / grain;
        let result = [];

        for(let i = 0; i < data.length; i += factor){
            let candle = Object.assign(data[i]);

            if(data[i + 1]){
                candle.close = data[i + 1].close;
                candle.volume += data[i + 1].volume;

                if(data[i + 1].low < candle.low){
                    candle.low = data[i + 1];
                }

                if(data[i + 1].high > candle.high){
                    candle.high = data[i + 1].high;
                }
            }

            if(data[i + 2]){
                candle.close = data[i + 2].close;
                candle.volume += data[i + 2].volume;

                if(data[i + 2].low < candle.low){
                    candle.low = data[i + 2];
                }

                if(data[i + 2].high > candle.high){
                    candle.high = data[i + 2].high;
                }
            }
        }

        return result;
    }

    fetch(start, end, granularity){
        return this.data[granularity] ? this.data[granularity].filter(datum => datum.date >= start && datum.date <= end) : [];

        //TODO have this method attempt to recursively fill in gaps in the data
        // for(let grain of Object.keys(this.skyline).sort()){
        //     if(grain <= granularity && granularity % grain === 0){
        //         for(let range of this.skyline[grain]){
        //             if(range.start <= start && range.end >= end){
        //                 let data = this.data[grain].filter(datum => datum >= start && datum <= end);
        //                 return this.combine(data, grain, granularity);
        //             }
        //         }
        //     }
        // }
    }

    async query(start, end, granularity){
        if(this.throttle){
            // console.log('throttle killed it');
            return;
        }

        this.throttle = true;
        setTimeout(() => this.throttle = false, 1500);

        // console.log(this.skyline[granularity]);

        if(this.available(start, end, granularity)){
            // console.log('fetched instead');
            return this.fetch(start, end, granularity);
        }

        for(let grain of Object.keys(this.skyline).sort()){
            if(grain <= granularity && granularity % grain === 0){
                for(let range of this.skyline[grain]){
                    if(range.start <= start && range.end >= end){
                        let data = this.data[grain].filter(datum => datum >= start && datum <= end);
                        return this.combine(data, grain, granularity);
                    }
                }
            }
        }

        //Calculate how many candles we need to fetch and perform the source requests
        let candles = Math.ceil((end.getTime() - start.getTime()) / granularity);
        let promises = [];

        for(let i = 0; i < candles; i += this.maxCandlesFromRequest){
            let frameStart = new Date(start.getTime() + (this.maxCandlesFromRequest * granularity * i));
            let frameEnd = new Date(start.getTime() + (this.maxCandlesFromRequest * granularity));

            if(frameEnd > end){
                frameEnd = end;
            }

            promises.push(this.source({start: frameStart, end: frameEnd, granularity}));
        }

        let requestsFromSource = await Promise.all(promises);
        let result = [];

        for(let response of requestsFromSource){
            response.sort((a, b) => a.date - b.date);
            this.add(response, granularity);
            result = result.concat(response);
        }

        return result;
    }

    destroy(){
        this.skyline = null;
        this.data = null;
    }

    onDidModifyData(callback){
        return this.emitter.on('did-modify-data', callback);
    }
}
