(ns excelebration.macros
  (:use [excelebration.publish :only [create-sheet]]))

(defmacro with-sheet [renderer sheet-name & forms]
  (let [sheet (gensym)]
    `(let [~sheet (create-sheet ~renderer ~sheet-name)]
       ~@(map (fn [f]
                `(~(first f) ~sheet ~@(next f))) forms)
       ~sheet)))

(defn wrap-src [src]
  (if (vector? src)
    (vec (list* :div src))
    src))



