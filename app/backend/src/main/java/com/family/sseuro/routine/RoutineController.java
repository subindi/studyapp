package com.family.sseuro.routine;

import com.family.sseuro.auth.AuthUser;
import com.family.sseuro.routine.RoutineDtos.NewRoutineRequest;
import com.family.sseuro.routine.RoutineDtos.RoutineDto;
import com.family.sseuro.routine.RoutineDtos.RoutineRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 반복 할 일 관리 (부모 모드에서만) */
@RestController
@RequestMapping("/api/parent/children/{childId}/routines")
public class RoutineController {
    private final RoutineService routines;

    public RoutineController(RoutineService routines) {
        this.routines = routines;
    }

    @GetMapping
    public List<RoutineDto> list(@AuthenticationPrincipal AuthUser me, @PathVariable long childId) {
        return routines.list(me, childId);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public RoutineDto create(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @Valid @RequestBody NewRoutineRequest body) {
        return routines.create(me, childId, body.requestId(), body.routine(), body.addToday());
    }

    @PutMapping(path = "/{routineId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public RoutineDto update(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long routineId,
                             @Valid @RequestBody RoutineRequest body) {
        return routines.update(me, childId, routineId, body);
    }

    @DeleteMapping("/{routineId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser me, @PathVariable long childId, @PathVariable long routineId) {
        routines.deactivate(me, childId, routineId);
        return ResponseEntity.noContent().build();
    }
}
