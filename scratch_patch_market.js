const fs = require('fs');
let content = fs.readFileSync('app/market/page.tsx', 'utf8');

const oldNav = `      {/* Timeframe Selector Nav */}
      <nav className="market-timeframes" aria-label="Chart timeframe">
        {TIMEFRAMES.map((range) => (
          <button
            key={range}
            className={timeframe === range ? "timeframe timeframe--active" : "timeframe"}
            type="button"
            onClick={() => {
              setLoading(true);
              if (range === timeframe) void refresh();
              else setTimeframe(range);
            }}
          >
            {range}
          </button>
        ))}
      </nav>

      {/* Stock Cards 6-Grid */}`;

const oldSection = `        {/* Chart View Toggle (Candles vs Area Line) */}
        <div className="chart-mode-group" role="group" aria-label="Chart representation">
          <button
            type="button"
            className={\`chart-mode-btn \${chartType === "candles" ? "chart-mode-btn--active" : ""}\`}
            onClick={() => setChartType("candles")}
          >
            Candlesticks
          </button>
          <button
            type="button"
            className={\`chart-mode-btn \${chartType === "area" ? "chart-mode-btn--active" : ""}\`}
            onClick={() => setChartType("area")}
          >
            Area Line
          </button>
        </div>
      </section>`;

const newSection = `        <div className="market-top-controls__right">
          {/* Timeframe Selector Nav */}
          <nav className="market-timeframes" aria-label="Chart timeframe">
            {TIMEFRAMES.map((range) => (
              <button
                key={range}
                className={timeframe === range ? "timeframe timeframe--active" : "timeframe"}
                type="button"
                onClick={() => {
                  setLoading(true);
                  if (range === timeframe) void refresh();
                  else setTimeframe(range);
                }}
              >
                {range}
              </button>
            ))}
          </nav>

          {/* Chart View Toggle (Candles vs Area Line) */}
          <div className="chart-mode-group" role="group" aria-label="Chart representation">
            <button
              type="button"
              className={\`chart-mode-btn \${chartType === "candles" ? "chart-mode-btn--active" : ""}\`}
              onClick={() => setChartType("candles")}
            >
              Candles
            </button>
            <button
              type="button"
              className={\`chart-mode-btn \${chartType === "area" ? "chart-mode-btn--active" : ""}\`}
              onClick={() => setChartType("area")}
            >
              Area
            </button>
          </div>
        </div>
      </section>`;

if (content.includes(oldSection) && content.includes(oldNav)) {
  content = content.replace(oldSection, newSection);
  content = content.replace(oldNav, '      {/* Stock Cards 6-Grid */}');
  fs.writeFileSync('app/market/page.tsx', content, 'utf8');
  console.log("MARKET_UPDATED_SUCCESS");
} else {
  console.log("NOT_FOUND", content.includes(oldSection), content.includes(oldNav));
}
