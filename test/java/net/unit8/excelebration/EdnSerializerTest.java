package net.unit8.excelebration;

import clojure.lang.PersistentVector;
import org.junit.Before;
import org.junit.Test;
import org.pegdown.Extensions;
import org.pegdown.LinkRenderer;
import org.pegdown.PegDownProcessor;
import org.pegdown.ToHtmlSerializer;
import org.pegdown.ast.RootNode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;

/**
 * @author kawasima
 */
public class EdnSerializerTest {
    RootNode rootNode;

    @Before
    public void setUpMarkdown() throws IOException {
        Path mdFile = Paths.get("dev-resources/gfm.md");
        String markdownSource = new String(Files.readAllBytes(mdFile));
        PegDownProcessor processor = new PegDownProcessor(Extensions.ALL);
        rootNode = processor.parseMarkdown(markdownSource.toCharArray());
    }

    @Test
    public void test() {
        EdnSerializer serializer = new EdnSerializer();
        System.out.println(serializer.toEdn(rootNode));
    }

    @Test
    public void testToHtml() {
        String html = new ToHtmlSerializer(new LinkRenderer(), Collections.EMPTY_MAP).toHtml(rootNode);
        System.out.println(html);
    }
    @Test
    public void testCreatePersistentVector() {
        PersistentVector vec = PersistentVector.create("1", "2" , "3");
        System.out.println(vec);
    }
}
