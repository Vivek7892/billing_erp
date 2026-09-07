"""Improve Dashboard: use StatCard from UI.jsx, consistent colors, better layout"""

with open(r'd:\Billing_pos\billing_erp\frontend\src\pages\Dashboard.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

replacements = [
    # Import StatCard from UI
    ("import { Badge } from '../components/UI'",
     "import { Badge, StatCard, CardSkeleton, ErrorState } from '../components/UI'"),

    # Replace Today's Performance section with StatCard components
    ("""      <section>
        <p className=\"section-label\">Today's Performance</p>
        <div className=\"grid grid-cols-2 xl:grid-cols-4 gap-3\">
          <Stat
            label=\"Today's Sales\"
            value={fmt(
              dashboard.today_sales
            )}
            icon={TrendingUp}
            color=\"blue\"
            trend={salesTrend}
            highlight
            sub={`Yesterday: ${fmt(
              dashboard.yesterday_sales
            )}`}
          />

          <Stat
            label=\"Today's Profit\"
            value={fmt(
              dashboard.today_profit
            )}
            icon={DollarSign}
            color=\"green\"
            trend={profitTrend}
            sub={`Margin: ${
              dashboard.profit_margin || 0
            }%`}
          />

          <Stat
            label=\"Bills Today\"
            value={
              dashboard.today_bills || 0
            }
            icon={ShoppingBag}
            color=\"purple\"
            trend={billsTrend}
            sub={`Avg: ${fmt(
              dashboard.avg_bill_today
            )}/bill`}
          />

          <Stat
            label=\"Today's Collection\"
            value={fmt(dashboard.today_collection)}
            icon={CreditCard}
            color=\"orange\"
            sub={`Tax: ${fmt(dashboard.today_tax)}`}
          />
        </div>
      </section>""",
     """      <section>
        <p className=\"section-label\">Today's Performance</p>
        <div className=\"grid grid-cols-2 xl:grid-cols-4 gap-3\">
          <StatCard label=\"Today's Sales\" value={fmt(dashboard.today_sales)} icon={TrendingUp} color=\"blue\" trend={salesTrend} sub={`Yesterday: ${fmt(dashboard.yesterday_sales)}`} />
          <StatCard label=\"Today's Profit\" value={fmt(dashboard.today_profit)} icon={DollarSign} color=\"green\" trend={profitTrend} sub={`Margin: ${dashboard.profit_margin || 0}%`} />
          <StatCard label=\"Bills Today\" value={dashboard.today_bills || 0} icon={ShoppingBag} color=\"purple\" trend={billsTrend} sub={`Avg: ${fmt(dashboard.avg_bill_today)}/bill`} />
          <StatCard label=\"Today's Collection\" value={fmt(dashboard.today_collection)} icon={CreditCard} color=\"amber\" sub={`Tax: ${fmt(dashboard.today_tax)}`} />
        </div>
      </section>"""),

    # Replace This Month section
    ("""      <section>
        <p className=\"section-label\">This Month</p>
        <div className=\"grid grid-cols-2 xl:grid-cols-4 gap-3\">
          <Stat
            label=\"Month Sales\"
            value={fmt(
              dashboard.month_sales
            )}
            icon={BarChart2}
            color=\"blue\"
            sub={`Last month: ${fmt(
              dashboard.last_month_sales
            )}`}
            trend={pct(
              dashboard.month_sales,
              dashboard.last_month_sales
            )}
          />

          <Stat
            label=\"Month Profit\"
            value={fmt(
              dashboard.month_profit
            )}
            icon={TrendingUp}
            color=\"green\"
            sub={`${
              dashboard.month_bills || 0
            } invoices`}
          />

          <Stat
            label=\"Pending Credit\"
            value={fmt(
              dashboard.pending_credit
            )}
            icon={CreditCard}
            color=\"red\"
            sub={`${
              dashboard.total_customers || 0
            } customers`}
          />

          <Stat
            label=\"Pending Purchases\"
            value={fmt(
              dashboard.pending_purchases
            )}
            icon={Truck}
            color=\"orange\"
            sub={`${
              dashboard.total_suppliers || 0
            } suppliers`}
          />
        </div>
      </section>""",
     """      <section>
        <p className=\"section-label\">This Month</p>
        <div className=\"grid grid-cols-2 xl:grid-cols-4 gap-3\">
          <StatCard label=\"Month Sales\" value={fmt(dashboard.month_sales)} icon={BarChart2} color=\"blue\" trend={pct(dashboard.month_sales, dashboard.last_month_sales)} sub={`Last month: ${fmt(dashboard.last_month_sales)}`} />
          <StatCard label=\"Month Profit\" value={fmt(dashboard.month_profit)} icon={TrendingUp} color=\"green\" sub={`${dashboard.month_bills || 0} invoices`} />
          <StatCard label=\"Pending Credit\" value={fmt(dashboard.pending_credit)} icon={CreditCard} color=\"red\" sub={`${dashboard.total_customers || 0} customers`} />
          <StatCard label=\"Pending Purchases\" value={fmt(dashboard.pending_purchases)} icon={Truck} color=\"amber\" sub={`${dashboard.total_suppliers || 0} suppliers`} />
        </div>
      </section>"""),

    # Improve Action Required section styling
    ("        <section className=\"rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5\">",
     "        <section className=\"rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 p-4 sm:p-5\">"),

    # Improve Business Insights section - use StatCard
    ("""      <section>
        <p className=\"section-label\">Business Insights</p>
        <div className=\"grid grid-cols-2 xl:grid-cols-4 gap-3\">
          <Insight
            label=\"Sales Growth\"
            value={`${
              dashboard.sales_growth > 0
                ? '+'
                : ''
            }${
              dashboard.sales_growth || 0
            }%`}
            icon={
              dashboard.sales_growth >= 0
                ? TrendingUp
                : TrendingDown
            }
            color={
              dashboard.sales_growth >= 0
                ? 'green'
                : 'orange'
            }
            note=\"vs last month\"
          />

          <Insight
            label=\"Profit Margin\"
            value={`${
              dashboard.profit_margin || 0
            }%`}
            icon={Percent}
            color=\"blue\"
            note=\"Today's margin\"
          />

          <Insight
            label=\"Avg Bill/Month\"
            value={fmt(
              dashboard.avg_bill_month
            )}
            icon={ShoppingCart}
            color=\"purple\"
            note=\"Per invoice this month\"
          />

          <Insight
            label=\"New Customers\"
            value={
              dashboard.new_customers_today ||
              0
            }
            icon={Users}
            color=\"green\"
            note=\"Registered today\"
          />
        </div>
      </section>""",
     """      <section>
        <p className=\"section-label\">Business Insights</p>
        <div className=\"grid grid-cols-2 xl:grid-cols-4 gap-3\">
          <StatCard label=\"Sales Growth\" value={`${dashboard.sales_growth > 0 ? '+' : ''}${dashboard.sales_growth || 0}%`} icon={dashboard.sales_growth >= 0 ? TrendingUp : TrendingDown} color={dashboard.sales_growth >= 0 ? 'green' : 'amber'} sub=\"vs last month\" />
          <StatCard label=\"Profit Margin\" value={`${dashboard.profit_margin || 0}%`} icon={Percent} color=\"blue\" sub=\"Today's margin\" />
          <StatCard label=\"Avg Bill/Month\" value={fmt(dashboard.avg_bill_month)} icon={ShoppingCart} color=\"purple\" sub=\"Per invoice this month\" />
          <StatCard label=\"New Customers\" value={dashboard.new_customers_today || 0} icon={Users} color=\"cyan\" sub=\"Registered today\" />
        </div>
      </section>"""),

    # Improve chart card borders (remove broken escaped newlines)
    ("border border-[var(--line)]\\r\\n            shadow-[var(--shadow-card)]",
     "border border-[var(--line)] shadow-[var(--shadow-card)]"),
]

count = 0
for old, new in replacements:
    if old in c:
        c = c.replace(old, new, 1)
        count += 1
    else:
        print(f'MISS: {old[:60]}')

with open(r'd:\Billing_pos\billing_erp\frontend\src\pages\Dashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print(f'Applied {count}/{len(replacements)} replacements')
