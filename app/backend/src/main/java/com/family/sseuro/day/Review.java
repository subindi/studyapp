package com.family.sseuro.day;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;

/** 하루 회고. mood: good(잘했어요) | different(조금 달랐어요) | hard(어려웠어요) */
@Entity
@Table(name = "review")
public class Review {
    @Embeddable
    public record Key(@Column(name = "child_id") Long childId, @Column(name = "activity_day") LocalDate day) implements Serializable {}

    @EmbeddedId
    private Key key;

    @Column(nullable = false, length = 10)
    private String mood;

    @Column(length = 200)
    private String note;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Review() {}

    Review(long childId, LocalDate day) {
        this.key = new Key(childId, day);
    }

    void update(String mood, String note, Instant now) {
        this.mood = mood;
        this.note = note;
        this.updatedAt = now;
    }

    public LocalDate getDay() {
        return key.day();
    }

    public String getMood() {
        return mood;
    }

    public String getNote() {
        return note;
    }
}
