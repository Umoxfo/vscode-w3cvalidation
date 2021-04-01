import { PerformanceObserver, performance } from 'perf_hooks';

const median = (arr, fn) => {
    const half = (arr.length / 2) | 0;
    const temp = arr.sort(fn);

    return (temp.length % 2) ? temp[half] : (temp[half - 1] + temp[half]) / 2;
};

function measure(fn, loop = 100) {
    return new Promise((resolve) => {
        const obs = new PerformanceObserver((items) => {
            const durations = [];
            for (const perf of items.getEntriesByType('function')) {
                durations.push(perf.duration);
            }
            const average = durations.reduce((a, b) => a + b, 0) / durations.length;
            const med = median(durations);
            obs.disconnect();
            resolve({ average, median: med });
        });
        obs.observe({ entryTypes: ['function'], buffered: true });
        const f = performance.timerify(fn);

        for (let i = 0; i < loop; i++) f();
    });
};

/* (async () => {
    //#region Test code
    function testFunction() {
        JSON.stringify(JSON.parse(MessageText));
        // JSON.stringify(MessageText.replace(/\s{2,}/gm, ""));
    }
    //#endregion Test code


    let time = await measure(() => testFunction(), 10000);
    console.log(time);
})();
*/
