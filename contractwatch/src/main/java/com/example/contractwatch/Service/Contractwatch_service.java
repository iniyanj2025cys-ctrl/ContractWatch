package com.example.contractwatch.Service;

import com.example.contractwatch.Model.ContractStatus;
import com.example.contractwatch.Model.ContractWatch_model;
import com.example.contractwatch.Repository.Contractwatch_repo;
import com.example.contractwatch.Repository.RenewalHistoryRepository;
import com.example.contractwatch.Model.RenewalHistory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class Contractwatch_service {
    private final Contractwatch_repo repository;
    private final RenewalHistoryRepository historyRepository;
    public Contractwatch_service(Contractwatch_repo repository, RenewalHistoryRepository historyRepository) { this.repository = repository; this.historyRepository = historyRepository; }

    public List<ContractWatch_model> list(String query, ContractStatus status, String attention) {
        LocalDate today = LocalDate.now();
        return repository.findAll().stream()
                .filter(c -> status == null || c.getStatus() == status)
                .filter(c -> query == null || query.isBlank() ||
                        contains(c.getContractName(), query) || contains(c.getVendor(), query))
                .filter(c -> matchesAttention(c, attention, today))
                .sorted(Comparator.comparing(ContractWatch_model::getEndDate)).toList();
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT));
    }
    private boolean matchesAttention(ContractWatch_model c, String attention, LocalDate today) {
        if (attention == null || attention.isBlank() || attention.equalsIgnoreCase("all")) return true;
        long days = ChronoUnit.DAYS.between(today, c.getEndDate());
        return switch (attention.toLowerCase(Locale.ROOT)) {
            case "critical" -> days >= 0 && days <= 7 && active(c);
            case "due-soon" -> days > 7 && days <= 30 && active(c);
            case "overdue" -> days < 0 && active(c);
            case "pending" -> c.getStatus() == ContractStatus.PENDING;
            case "completed" -> c.getStatus() == ContractStatus.RENEWED;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "attention must be all, critical, due-soon, overdue, pending, or completed");
        };
    }
    private boolean active(ContractWatch_model c) { return c.getStatus() == ContractStatus.ACTIVE || c.getStatus() == ContractStatus.PENDING; }

    public ContractWatch_model get(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract " + id + " was not found"));
    }
    public ContractWatch_model create(ContractWatch_model c) {
        c.setId(null);
        validatePeriod(c.getStartDate(), c.getEndDate());
        if (c.getStatus() == null) c.setStatus(ContractStatus.ACTIVE);
        return repository.save(c);
    }
    public ContractWatch_model update(Long id, ContractWatch_model input) {
        validatePeriod(input.getStartDate(), input.getEndDate());
        ContractWatch_model c = get(id);
        c.setContractName(input.getContractName()); c.setVendor(input.getVendor()); c.setVendorEmail(input.getVendorEmail());
        c.setAmount(input.getAmount()); c.setCurrency(input.getCurrency()); c.setStartDate(input.getStartDate()); c.setEndDate(input.getEndDate());
        c.setRenewalNoticeDays(input.getRenewalNoticeDays()); c.setStatus(input.getStatus()); c.setNotes(input.getNotes());
        c.setDiscountPercent(input.getDiscountPercent()); c.setDiscountAmount(input.getDiscountAmount()); c.setDiscountDeadline(input.getDiscountDeadline());
        return repository.save(c);
    }
    public void delete(Long id) { repository.delete(get(id)); }
    public ContractWatch_model setStatus(Long id, ContractStatus status) {
        if (status == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is required");
        ContractWatch_model c = get(id); c.setStatus(status); return repository.save(c);
    }
    @Transactional
    public ContractWatch_model renew(Long id, LocalDate newEndDate, BigDecimal newAmount, BigDecimal discountPercent) {
        ContractWatch_model c = get(id);
        if (newEndDate == null || !newEndDate.isAfter(c.getEndDate()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "newEndDate must be after the current endDate");
        if (discountPercent != null && discountPercent.compareTo(new BigDecimal("100")) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "discountPercent cannot exceed 100");
        LocalDate previousEndDate = c.getEndDate();
        BigDecimal previousAmount = c.getAmount();
        c.setEndDate(newEndDate);
        if (newAmount != null) c.setAmount(newAmount);
        c.setDiscountPercent(discountPercent);
        c.setStatus(ContractStatus.ACTIVE);
        ContractWatch_model renewed = repository.save(c);
        historyRepository.save(new RenewalHistory(renewed, previousEndDate, previousAmount, discountPercent));
        return renewed;
    }
    public List<RenewalHistory> history(Long id) { get(id); return historyRepository.findByContractIdOrderByRenewedAtDesc(id); }
    private void validatePeriod(LocalDate start, LocalDate end) {
        if (start == null || end == null || !end.isAfter(start))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate must be after startDate");
    }
    public Map<String, Object> summary() {
        LocalDate today = LocalDate.now();
        List<ContractWatch_model> all = repository.findAll();
        long expiringThisMonth = all.stream().filter(this::active).filter(c -> c.getEndDate().getYear() == today.getYear() && c.getEndDate().getMonth() == today.getMonth()).count();
        long dueSoon = all.stream().filter(this::active).filter(c -> { long d = ChronoUnit.DAYS.between(today, c.getEndDate()); return d >= 0 && d <= 30; }).count();
        long overdue = all.stream().filter(this::active).filter(c -> c.getEndDate().isBefore(today)).count();
        long activeCount = all.stream().filter(c -> c.getStatus() == ContractStatus.ACTIVE).count();
        BigDecimal totalValue = all.stream().filter(c -> c.getStatus() == ContractStatus.ACTIVE).map(ContractWatch_model::getAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        long activeDiscounts = all.stream().filter(c -> c.getDiscountDeadline() != null && !c.getDiscountDeadline().isBefore(today) && c.getDiscountAmount() != null).count();
        BigDecimal potentialSavings = all.stream().filter(c -> c.getDiscountDeadline() != null && !c.getDiscountDeadline().isBefore(today)).map(ContractWatch_model::getDiscountAmount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of("totalContracts", all.size(), "expiringThisMonth", expiringThisMonth, "renewalsDueSoon", dueSoon,
                "overdueRenewals", overdue, "activeContracts", activeCount, "totalContractValue", totalValue,
                "activeDiscounts", activeDiscounts, "potentialSavings", potentialSavings);
    }
    public List<ContractWatch_model> discounts() {
        return repository.findAll().stream().filter(c -> c.getDiscountPercent() != null || c.getDiscountAmount() != null)
                .sorted(Comparator.comparing(c -> c.getDiscountDeadline() == null ? LocalDate.MAX : c.getDiscountDeadline())).toList();
    }
}
