(defproject net.unit8.excelebration/excelebration "0.2.0"
  :description "A document generator from markdown or S-expression to HTML and MS-Excel."
  :url "https://github.com/kawasima/excelebration"
  :license {:name "Eclipse Public Licese - v 1.0"
            :url "http://www.eclipse.org/legal/epl-v10.html"
            :distribution :repo
            :comments "same as Clojure"}

  :dependencies [[org.clojure/clojure "1.8.0"]
                 [net.unit8.axebomber/axebomber-clj "0.1.1"]
                 [org.pegdown/pegdown "1.6.0"]
                 [org.clojure/tools.logging "0.3.1"]
                 [org.clojure/tools.cli "0.3.5"]
                 [hiccup "1.0.5"]
                 [junit "4.12" :scope "test"]]
  :source-paths ["src/clj"]
  :java-source-paths ["src/java"]
  :test-paths ["test/java"]
  :main excelebration.core)
