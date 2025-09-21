// UMD-artig: hängt Funktion an window
(function (root) {
    function DS_addCssStyle(theme) {
    const g = theme; // kurz
    const cssStyle = `
    .scriptContainer{
      width:${g.widthInterface}%;
      background:${g.backgroundContainer};
      aspect-ratio:100 / 29;
      cursor:move;
      z-index:50;
      border-radius:15px;
      border-style:solid;
      border-width:5px 5px;
      border-color:${g.backgroundHeader};
    }
    .scriptHeader{
      color:${g.textColor};
      background:${g.backgroundHeader};
      width:100%;
      margin:0 auto;
      display:flex;
      justify-content:center;
      align-items:center;
    }
    .scriptFooter{
      color:${g.textColor};
      background:${g.backgroundHeader};
      width:100%;
      margin:0 auto;
      display:flex;
      justify-content:right;
      align-items:center;
      margin-right:50px;
    }
    .scriptTable{
      position:relative;width:95%;border-collapse:collapse;table-layout:fixed;
      margin:20px auto;
    }
    .scriptTable td{
      width:auto;overflow:hidden;text-overflow:ellipsis;
      border:1px solid ${g.borderColor};padding:10px;text-align:center;color:${g.textColor};word-wrap:break-word;
    }
    .scriptTable tr:nth-child(odd){background:${g.getColorDarker(g.backgroundMainTable, g.headerColorAlternateTable)};}
    .scriptTable tr:nth-child(even){background:${g.backgroundMainTable};}
    .scriptTable tr:first-child{
      border:1px solid ${g.borderColor};padding:15px;text-align:center;color:${g.textColor};
      background:${g.getColorDarker(g.backgroundMainTable, g.headerColorDarken)};
    }
    .scriptTable tr:not(:first-child):hover{
      background-color:${g.getColorDarker(g.backgroundMainTable, g.headerColorAlternateHover)};
    }

    /* ... (lasse deine anderen Blocks hier wie gehabt, ersetze alle Variablen durch g.*)
       Beispiele:
       ${g.backgroundInnerTable}, ${g.backgroundAlternateTableOdd}, ${g.headerWood}, usw.
       und für Funktion-Aufrufe: g.getColorDarker(...), g.invertColor(...), g.padZero(...)
    */

    input[type="text"]:disabled{
      background:${g.getColorDarker(g.invertColor(g.textColor),50)};
      text-align:center;
    }`;

    const head = document.head || document.getElementsByTagName("head")[0];
    const style = document.createElement("style");
    style.type = "text/css";
    if (style.styleSheet) style.styleSheet.cssText = cssStyle;
    else style.appendChild(document.createTextNode(cssStyle));
    head.appendChild(style);
  }

  root.DS_addCssStyle = DS_addCssStyle;
})(window);
