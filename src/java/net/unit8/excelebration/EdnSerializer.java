package net.unit8.excelebration;

import clojure.lang.Keyword;
import clojure.lang.PersistentArrayMap;
import clojure.lang.PersistentVector;
import clojure.lang.RT;
import org.pegdown.ast.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * @author kawasima
 */
public class EdnSerializer implements Visitor {
    private PersistentVector current;

    protected TableNode currentTableNode;
    protected int currentTableColumn;
    protected boolean inTableHeader;

    public EdnSerializer() {
        current = PersistentVector.EMPTY;
    }

    public String toEdn(RootNode astRoot) {
        astRoot.accept(this);
        return RT.printString(current);
    }

    private void toVector(SuperNode node, String tagName) {
        PersistentVector tmp = current;
        PersistentVector tag = PersistentVector.create(RT.keyword(null, tagName));
        current = tag;
        visitChildren(node);
        current = tmp.cons(current);
    }

    private void toVector(TextNode node, String tagName) {
        PersistentVector tmp = current;
        PersistentVector tag = PersistentVector.create(
                RT.keyword(null, tagName),
                node.getText());
        current = tmp.cons(tag);
    }

    @Override
    public void visit(AbbreviationNode node) {
        // TODO
    }

    @Override
    public void visit(AutoLinkNode node) {
        // TODO
    }


    @Override
    public void visit(BlockQuoteNode node) {
        toVector(node, "blockquote");
    }

    @Override
    public void visit(BulletListNode node) {
        toVector(node, "ul");
    }

    @Override
    public void visit(CodeNode node) {
        toVector(node, "code");
    }

    @Override
    public void visit(DefinitionListNode node) {
        toVector(node, "dl");
    }

    @Override
    public void visit(DefinitionNode node) {
        toVector(node, "dd");
    }

    @Override
    public void visit(DefinitionTermNode node) {
        toVector(node, "dt");
    }

    @Override
    public void visit(ExpImageNode node) {
        // TODO
    }

    @Override
    public void visit(ExpLinkNode node) {
        // TODO
    }

    @Override
    public void visit(HeaderNode node) {
        toVector(node, "h" + node.getLevel());
    }

    @Override
    public void visit(HtmlBlockNode node) {
        current.cons(node.getText());
    }

    @Override
    public void visit(InlineHtmlNode node) {
        current.cons(node.getText());
    }

    @Override
    public void visit(ListItemNode node) {

        toVector(node, "li");
    }

    @Override
    public void visit(MailLinkNode node) {
        // TODO
    }

    @Override
    public void visit(OrderedListNode node) {
        toVector(node, "ol");
    }

    @Override
    public void visit(ParaNode node) {
        toVector(node, "p");
    }

    @Override
    public void visit(QuotedNode node) {
        switch (node.getType()) {
            case DoubleAngle:
                current = current.cons("<<");
                visitChildren(node);
                current = current.cons(">>");
                break;
            case Double:
                current = current.cons("\"");
                visitChildren(node);
                current = current.cons("\"");
                break;
            case Single:
                current = current.cons("\'");
                visitChildren(node);
                current = current.cons("\'");
                break;
        }
    }

    @Override
    public void visit(ReferenceNode node) {
        // reference nodes are not printed
    }

    @Override
    public void visit(RefImageNode node) {
        // TODO
    }

    @Override
    public void visit(RefLinkNode node) {
        // TODO
    }

    @Override
    public void visit(RootNode node) {
        visitChildren(node);
    }

    @Override
    public void visit(SimpleNode node) {
        switch(node.getType()) {
            case Apostrophe:
                current = current.cons("'");
                break;
            case Ellipsis:
                current = current.cons("…");
                break;
            case Emdash:
                current = current.cons("ー");
                break;
            case Endash:
                current = current.cons("―");
                break;
            case HRule:
                current = current.cons(PersistentVector.create(RT.keyword(null, "hr")));
                break;
            case Linebreak:
                current = current.cons(PersistentVector.create(RT.keyword(null, "br")));
                break;
            case Nbsp:
                current = current.cons(" ");
                break;
            default:
                throw new IllegalStateException();
        }
    }

    @Override
    public void visit(SpecialTextNode node) {
        current = current.cons(node.getText());
    }

    @Override
    public void visit(StrikeNode node) {
        toVector(node, "del");
    }

    @Override
    public void visit(StrongEmphSuperNode node) {
        if (node.isClosed()) {
            if (node.isStrong()) {
                toVector(node, "strong");
            } else {
                toVector(node, "em");
            }
        } else {
            current = current.cons(node.getChars());
            visitChildren(node);
        }
    }

    @Override
    public void visit(TableBodyNode node) {
        // toVector(node, "tbody");
    }

    @Override
    public void visit(TableCaptionNode node) {
        // toVector(node, "caption");
    }

    @Override
    public void visit(TableCellNode node) {
        String tagName = inTableHeader ? "th" : "td";
        List<TableColumnNode> columns = currentTableNode.getColumns();
        TableColumnNode column = columns.get(Math.min(currentTableColumn, columns.size()-1));

        PersistentVector tag = PersistentVector.create(RT.keyword(null, tagName));
        column.accept(this);
        if (node.getColSpan() > 1) {
            Map<Keyword, String> attrs = new HashMap<Keyword, String>();
            attrs.put(RT.keyword(null, "colspan"), Integer.toString(node.getColSpan()));
            tag = tag.cons(PersistentArrayMap.create(attrs));
        }
        PersistentVector orig = current;
        current = tag;
        visitChildren(node);
        orig.cons(current);
        current = orig;

        currentTableColumn += node.getColSpan();

    }

    @Override
    public void visit(TableColumnNode node) {

    }

    @Override
    public void visit(TableHeaderNode node) {
        inTableHeader = true;
        visitChildren(node);
        inTableHeader = false;
    }

    @Override
    public void visit(TableNode node) {
        currentTableNode = node;
        toVector(node, "table");
        currentTableNode = null;
    }

    @Override
    public void visit(TableRowNode node) {
        currentTableColumn = 0;
        toVector(node, "tr");
    }

    @Override
    public void visit(VerbatimNode node) {
        // TODO
    }

    @Override
    public void visit(WikiLinkNode node) {
        // TODO
    }

    @Override
    public void visit(TextNode node) {
        current = current.cons(node.getText());
    }

    @Override
    public void visit(SuperNode node) {
        visitChildren(node);
    }

    @Override
    public void visit(Node node) {
        // TODO
    }


    protected void visitChildren(SuperNode node) {
        for (Node child : node.getChildren()) {
            child.accept(this);
        }
    }
}
