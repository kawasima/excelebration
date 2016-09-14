(ns excelebration.core
  (:require [clojure.tools.cli :refer [parse-opts]]
            [clojure.string :as string]
            [clojure.tools.logging :as log]
            [excelebration.publish :refer [publish]]))

(def cli-options
  ;; An option with a required argument
  [["-i" "--input INPUT_FILE" "input file"]
   ;; A non-idempotent option
   ["-o" "--output OUTPUT_FILE" "output file"]
   ;; Format option
   ["-f" "--format FORMAT" "format"]
   ;; Template
   [nil "--template Template" "template"]
   ;; A boolean option defaulting to nil
   ["-h" "--help"]])

(defn usage [options-summary]
  (->> ["This is my program. There are many like it, but this one is mine."
        ""
        "Usage: program-name [options] action"
        ""
        "Options:"
        options-summary
        ""
        "Please refer to the manual page for more information."]
    (string/join \newline)))

(defn error-msg [errors]
  (str "The following errors occurred while parsing your command:\n\n"
    (string/join \newline errors)))

(defn- exit [status msg]
  (log/info msg)
  (System/exit status))

(defn -main [& args]
  (let [{:keys [options arguments errors summary]} (parse-opts args cli-options)]
    (cond
      (:help options) (exit 0 (usage summary))
      ;(not= (count arguments) 1) (exit 1 (usage summary))
      errors (exit 1 (error-msg errors)))
    (let [{:keys [input output format] :or {output *out* format :excel}} options]
      (when-not input
        (exit -1 "Input file is required."))
      (publish input output (keyword format) options))))
