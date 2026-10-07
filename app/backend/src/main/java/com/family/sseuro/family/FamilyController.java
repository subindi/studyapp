package com.family.sseuro.family;

import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.family.FamilyDtos.ChildDto;
import com.family.sseuro.family.FamilyDtos.ChildSettings;
import com.family.sseuro.family.FamilyDtos.FamilyView;
import com.family.sseuro.family.FamilyDtos.NewChildRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FamilyController {
    private final FamilyService family;

    public FamilyController(FamilyService family) {
        this.family = family;
    }

    public record RenameRequest(@NotBlank @Size(max = 30) String name) {}

    /** 모드 선택 화면 (아이 모드에서도) */
    @GetMapping("/api/family")
    public FamilyView view(@AuthenticationPrincipal AuthUser me) {
        return family.view(me);
    }

    @PutMapping(path = "/api/parent/family", consumes = MediaType.APPLICATION_JSON_VALUE)
    public FamilyView rename(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody RenameRequest body) {
        return family.rename(me, body.name());
    }

    @PostMapping(path = "/api/parent/children", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ChildDto create(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody NewChildRequest body) {
        return family.create(me, body);
    }

    @PutMapping(path = "/api/parent/children/{childId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ChildDto update(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @Valid @RequestBody ChildSettings body) {
        return family.update(me, childId, body);
    }
}
