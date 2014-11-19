(with-sheet renderer "表紙"
  (render {:x 1 :y 1} (str (get opts :client-name "上") "様"))
  (render {:x 5 :y 9}
    [:table 
     [:tr
      [:td {:data-width 44} (get opts :project-name "ほげプロジェクト")]]]))

(doseq [source sources]
  (with-sheet renderer "sheet1"
    (render {:x 0 :y 0}
      [:table
       [:tr {:rowspan 2}
        [:td {:data-width 21}
         "sheet2"]
        [:td {:data-width 4} "システム名"]
        [:td {:data-width 8} (get opts :system-name "ほげシステム")]]])
    (render {:x 0 :y 3} (wrap-src source))))

