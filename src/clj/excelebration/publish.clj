(ns excelebration.publish
  (:require [clojure.java.io :as io]
            [clojure.string :as string]
            [axebomber.renderer.html :as renderer-html]
            [axebomber.renderer.excel :as renderer-excel]
            [clojure.tools.logging :as log]
            [hiccup.core :refer :all]
            [hiccup.page :refer :all]
            [axebomber.usermodel :refer [create-workbook to-grid]]
            [axebomber.style :refer [create-style]])
  (:import  [org.pegdown PegDownProcessor Extensions]
            [net.unit8.excelebration EdnSerializer]))

(defprotocol Renderer
  (init [this])
  (create-sheet [this sheet-name])
  (get-render-fn [this])
  (write-workbook [this wtr]))

(deftype ExcelRenderer [workbook]
  Renderer
  (init [_]
    (create-style "h2" :margin-top 1 :font-weight "bold" :color "grey80" :background-color "gold")
    (create-style "h3" :margin-top 1 :font-weight "bold")
    (create-style "ul" :margin-left 1))
  (create-sheet [_ sheet-name]
    (log/info "createSheet:" sheet-name)
    (to-grid (.createSheet workbook sheet-name)))
  (get-render-fn [_] renderer-excel/render)
  (write-workbook [_ wtr]
    (log/info "Write workbook")
    (.write workbook wtr)))

(deftype HtmlRenderer [workbook]
  Renderer
  (init [_])
  (create-sheet [_ sheet-name])
  (get-render-fn [_] renderer-html/render)
  (write-workbook [_ wtr]
    (let [sheet [:div.jagrid]]
      (.write wtr
              (.getBytes (html5
                          [:head
                           (include-css "jagrid.css")
                           (include-js  "jagrid.js")]
                          [:body sheet]))))))

(defn- parse-markdown [rdr]
  (let [edn-str (-> (.. (EdnSerializer.)
                        (toEdn (.. (PegDownProcessor. Extensions/ALL)
                                   (parseMarkdown (.toCharArray (string/join "\n" (line-seq rdr)))))))
                    (.replace \newline \space))]
    (log/info edn-str)
    edn-str))

(defn read-template [file]
  (with-open [r (java.io.PushbackReader. (io/reader file))]
    (loop [s []]
      (if-let [v (read r false nil)]
        (recur (conj s v))
        s))))

(defn render-with-template [renderer source template-seq]
  (let [nspace (create-ns (gensym "sandbox"))]
    (binding [*ns* nspace]
      (intern *ns* 'sources [source])
      (intern *ns* 'opts {})
      (intern *ns* 'renderer renderer)
      (intern *ns* 'render (get-render-fn renderer))
      (refer-clojure)
      (use '[excelebration.macros])
      (loop [exprs template-seq, idx 1]
        (when (seq exprs)
          (eval (first exprs))
          (recur (rest exprs) (inc idx)))))))


(defn render [renderer source wtr options]
  (render-with-template renderer source
                        (if-let [template-file (:template options)]
                          (read-template template-file)
                          ['(doseq [source sources]
                              (with-sheet renderer "Sheet1" (render {:x 0 :y 0} (wrap-src source))))])))

(defn publish [in-file out-file fmt options]
  (with-open [rdr (io/reader in-file)]
    (let [src (read-string
                (if (.endsWith (.getName (io/as-file in-file)) ".md")
                  (parse-markdown rdr)
                  (string/join (line-seq rdr))))
          renderer (case fmt
                     :excel (ExcelRenderer. (create-workbook))
                     :html (HtmlRenderer. {}))]
      (if (= out-file *out*)
        (render renderer src out-file options)
        (with-open [wtr (io/output-stream out-file)]
          (render renderer src wtr options)
          (write-workbook renderer wtr))))))
