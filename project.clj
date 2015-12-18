(defproject net.unit8/excelebration "0.1.0"
  :dependencies [[org.clojure/clojure "1.6.0"]
                 [net.unit8/axebomber-clj "0.1.1"]
                 [org.pegdown/pegdown "1.5.0"]
                 [org.clojure/tools.logging "0.3.1"]
                 [org.clojure/tools.cli "0.3.1"]
                 [hiccup "1.0.5"]
                 [junit "4.12" :scope "test"]]
  :source-paths ["src/clj"]
  :java-source-paths ["src/java"]
  :test-paths ["test/java"]
  :main excelebration.core)

